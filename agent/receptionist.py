"""Voice receptionist: Sarvam STT -> LangGraph workflow (Sarvam LLM + tools) -> Sarvam TTS.

The clinic is chosen from the room name ("clinic-<slug>-<suffix>", set by the web app's
token route); other rooms (e.g. the Agents Playground) use DEFAULT_CLINIC_SLUG.

Usage (from agent/):
  uv run python receptionist.py dev       # join LiveKit Cloud rooms (needs LIVEKIT_* in .env)
  uv run python receptionist.py console   # talk through local mic/speakers
"""

import asyncio
import logging
import os
import re
from datetime import datetime, timezone

from dotenv import load_dotenv
from langchain_sarvam import ChatSarvam
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, JobProcess, cli
from livekit.plugins import langchain, sarvam, silero

from clinic.repository import Repository, SupabaseRepository
from clinic.workflow import SessionState, build_graph, build_instructions

load_dotenv()

logger = logging.getLogger("receptionist")

# sarvam-105b is a reasoning model (~8s to first token); -conversations replies in ~0.3s.
LLM_MODEL = "sarvam-105b-conversations"
DEFAULT_CLINIC_SLUG = os.environ.get("DEFAULT_CLINIC_SLUG", "sanjeevani")
# How often a live call rechecks whether staff switched the agent off.
AVAILABILITY_RECHECK_SECONDS = 60

GREETING = (
    "Greet the patient warmly in English, say the clinic name, and ask how you can help. "
    "{hindi}Keep it short."
)
HINDI_OFFER = "Then add one short sentence in Hindi, in Devanagari script, saying they can also speak Hindi. "
GOODBYE_UNAVAILABLE = (
    "The clinic has just switched off the online receptionist. Please call the clinic directly. Goodbye."
)


def clinic_slug_from_room(room_name: str) -> str:
    m = re.fullmatch(r"clinic-([a-z0-9-]+?)-[A-Za-z0-9]{6,}", room_name)
    return m.group(1) if m else DEFAULT_CLINIC_SLUG


def make_llm(state: SessionState) -> langchain.LLMAdapter:
    model = ChatSarvam(model=LLM_MODEL, streaming=True, temperature=0.2, max_tokens=300)
    # recursion_limit caps tool loops in one turn (each agent/tool step counts as one).
    return langchain.LLMAdapter(
        build_graph(model, state), config={"recursion_limit": 12}, stream_mode="custom"
    )


class Receptionist(Agent):
    def __init__(self, state: SessionState) -> None:
        super().__init__(instructions=build_instructions(state), llm=make_llm(state))
        self.state = state

    async def on_enter(self) -> None:
        hindi = HINDI_OFFER if self.state.clinic.voice_language == "hi-IN" else ""
        self.session.generate_reply(instructions=GREETING.format(hindi=hindi))


async def watch_availability(session: AgentSession, state: SessionState, policy: str) -> None:
    """Apply the clinic's ongoing-call policy if staff switch the agent off mid-call."""
    while True:
        await asyncio.sleep(AVAILABILITY_RECHECK_SECONDS)
        try:
            st = await state.repo.effective_state(state.clinic.id)
        except Exception:
            logger.warning("availability recheck failed", exc_info=True)
            continue
        if st.get("available"):
            continue
        state.changes_allowed = False
        if policy == "end":
            handle = session.say(GOODBYE_UNAVAILABLE, allow_interruptions=False)
            await handle.wait_for_playout()
            session.shutdown()
        return


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server = AgentServer(setup_fnc=prewarm)


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    repo: Repository = await SupabaseRepository.from_env()
    clinic = await repo.get_clinic(clinic_slug_from_room(ctx.room.name))
    if clinic is None:
        logger.error("unknown clinic for room %s", ctx.room.name)
        ctx.shutdown("unknown clinic")
        return

    availability = await repo.effective_state(clinic.id)
    call_id = await repo.start_call(clinic.id, ctx.room.name)
    state = SessionState(
        clinic=clinic,
        doctors=await repo.list_doctors(clinic.id),
        faqs=await repo.list_faqs(clinic.id),
        repo=repo,
    )

    async def log_call_end(reason: str) -> None:
        if call_id is None:
            return
        if not availability.get("available"):
            outcome = "rejected_unavailable"
        elif state.escalation_reason:
            outcome = "escalated"
        else:
            outcome = "completed"
        try:
            await repo.finish_call(
                call_id,
                ended_at=datetime.now(timezone.utc).isoformat(),
                outcome=outcome,
                actions=state.actions,
                escalation_reason=state.escalation_reason,
                callback_phone=state.callback_phone,
            )
        except Exception:
            logger.warning("could not finish call log", exc_info=True)

    ctx.add_shutdown_callback(log_call_end)

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=sarvam.STT(language="unknown", model="saaras:v4"),
        tts=sarvam.TTS(target_language_code=clinic.voice_language, model="bulbul:v3", speaker="priya"),
        # Sarvam transcripts can land after the default 0.5s endpoint, and patients pause while
        # reading out phone numbers; waiting longer stops the agent cutting them off.
        turn_handling={"endpointing": {"min_delay": 1.2, "max_delay": 4.0}},
    )

    if not availability.get("available"):
        # Server-side enforcement: no conversation when the agent is off, paused or closed.
        logger.info("agent unavailable for %s: %s", clinic.slug, availability.get("reason"))
        await session.start(agent=Agent(instructions="Say nothing."), room=ctx.room, record=False)
        message = availability.get("fallback_message") or GOODBYE_UNAVAILABLE
        if availability.get("fallback_mode") == "transfer" and availability.get("transfer_number"):
            message += f" You can reach our staff on {availability['transfer_number']}."
        handle = session.say(message, allow_interruptions=False)
        await handle.wait_for_playout()
        session.shutdown()
        return

    # record=False: no audio or transcript recordings without a consent and retention policy.
    await session.start(agent=Receptionist(state), room=ctx.room, record=False)
    watcher = asyncio.create_task(
        watch_availability(session, state, availability.get("ongoing_call_policy", "finish"))
    )
    ctx.add_shutdown_callback(lambda reason: _cancel(watcher))


async def _cancel(task: asyncio.Task) -> None:
    task.cancel()


if __name__ == "__main__":
    cli.run_app(server)
