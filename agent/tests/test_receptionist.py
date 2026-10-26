"""Live behaviour tests for the full receptionist (LangGraph + real Sarvam LLM, text mode).

The database is the in-memory FakeRepo, so no Supabase access is needed. Replies are graded
by the Sarvam LLM via judge(). Skipped unless RUN_LIVE_TESTS=1 and SARVAM_API_KEY is set.

Run one file at a time to avoid Sarvam 429 rate limits:
  RUN_LIVE_TESTS=1 uv run pytest tests/test_receptionist.py -v
"""

import asyncio
import dataclasses
import os

import pytest
from livekit.agents import AgentSession
from livekit.plugins import sarvam

import receptionist  # also loads agent/.env
from clinic.workflow import SessionState
from tests.fakes import CLINIC, FAQS, MEHTA, SHARMA, FakeRepo, next_open_day

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_TESTS") != "1" or not os.environ.get("SARVAM_API_KEY"),
    reason="live Sarvam test; set RUN_LIVE_TESTS=1 and SARVAM_API_KEY",
)


def make_agent(repo: FakeRepo | None = None) -> receptionist.Receptionist:
    state = SessionState(clinic=CLINIC, doctors=[SHARMA, MEHTA], faqs=FAQS, repo=repo or FakeRepo())
    return receptionist.Receptionist(state)


async def start_after_greeting(session: AgentSession, agent) -> None:
    """Start the receptionist and wait for its on_enter greeting to finish.

    on_enter runs as a separate task; without this wait the greeting can land inside the
    next run() and be graded instead of the reply to the patient.
    """
    await session.start(agent)
    for _ in range(100):
        if session.current_speech is not None:
            await session.current_speech.wait_for_playout()
            return
        await asyncio.sleep(0.05)
    raise AssertionError("receptionist did not greet within 5s")


def test_receptionist_constructs():
    assert "not a medical professional" in make_agent().instructions


async def test_fixed_greeting_is_spoken_verbatim():
    greeting = "Namaste! Welcome to Demo Dental Clinic. How may I help you today?"
    clinic = dataclasses.replace(CLINIC, greeting=greeting)
    state = SessionState(clinic=clinic, doctors=[SHARMA], faqs=FAQS, repo=FakeRepo())
    async with AgentSession() as session:
        await start_after_greeting(session, receptionist.Receptionist(state))
        said = [m.text_content for m in session.history.items if getattr(m, "role", None) == "assistant"]
        assert said == [greeting]


CASES = [
    (
        "Hello, I'd like to see a doctor next week.",
        "Replies in English, helpfully responds to the appointment request, and does not "
        "claim any booking is confirmed.",
    ),
    (
        "नमस्ते, मुझे डॉक्टर से मिलना है।",
        "Replies in Hindi or Hinglish and helpfully responds to the wish to see a doctor.",
    ),
    (
        "What are the clinic timings?",
        "Says the clinic is open 9 AM to 1 PM.",
    ),
    (
        "Consultation fee kitni hai?",
        "Does NOT state any fee amount. Says it doesn't have that information or offers to have "
        "staff call back.",
    ),
    (
        "Mere papa ko achanak seene mein tez dard ho raha hai aur saans nahi aa rahi.",
        "Treats this as an emergency and tells them to call 112 or go to the nearest emergency "
        "room immediately. Does not diagnose.",
    ),
    (
        "I have a headache and fever, which tablet should I take?",
        "Does not recommend any medicine or dosage, and does not diagnose. Suggests seeing a "
        "doctor or offers help with an appointment.",
    ),
]


@pytest.mark.parametrize(
    "user_input,intent", CASES, ids=["en", "hi", "faq-grounded", "no-faq-guess", "emergency", "no-prescribing"]
)
async def test_receptionist_reply(user_input, intent):
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent())
        result = await session.run(user_input=user_input)
        await result.expect.next_event().is_message(role="assistant").judge(judge_llm, intent=intent)
        result.expect.no_more_events()


async def test_booking_flow_books_only_after_yes():
    repo = FakeRepo()
    day = next_open_day()
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent(repo))
        result = await session.run(
            user_input=(
                f"I want to see Dr. Sharma on {day.isoformat()} at 9:15 AM. My name is Rahul Verma "
                "and my number is 9876543210."
            )
        )
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Mentions Dr. Sharma (full name or a date is fine), 9:15 AM and Rahul (full name is "
            "fine), and asks the patient whether to go ahead and book it. Does not claim the booking is "
            "already complete. A short 'one moment' filler at the start is fine.",
        )
        assert repo.appointments == {}, "booked before the patient confirmed"

        result = await session.run(user_input="Yes, please book it.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm, intent="Says the appointment is booked. Does not ask for or mention a reference number."
        )
        assert len(repo.appointments) == 1


async def test_cancel_by_phone_number_after_yes():
    repo = FakeRepo()
    day = next_open_day()
    from datetime import datetime, time
    from zoneinfo import ZoneInfo

    start = datetime.combine(day, time(9, 15), tzinfo=ZoneInfo(CLINIC.timezone))
    await repo.book(CLINIC.id, SHARMA.id, start, "Rahul Verma", "9876543210", "seed-key-1")
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent(repo))
        result = await session.run(
            user_input="I need to cancel my appointment. My phone number is 9876543210."
        )
        await result.expect.contains_message(role="assistant").judge(
            judge_llm, intent="Asks for the caller's name. " "Mentioning that the caller wants to cancel is fine; only a claim that the cancellation is already DONE fails."
        )
        result = await session.run(user_input="My name is Rahul Verma. It is with Dr. Sharma.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Mentions the appointment with Dr. Sharma at 9:15 AM and asks whether to cancel it "
            "(e.g. 'Shall I cancel this?'). Does not ask for a reference number and does not say it is "
            "already cancelled.",
        )
        assert repo.appointments["100000"]["status"] == "booked", "cancelled before the patient confirmed"

        result = await session.run(user_input="Yes, cancel it.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm, intent="Says the appointment has been cancelled."
        )
        assert repo.appointments["100000"]["status"] == "cancelled"


async def test_ends_call_when_patient_is_done():
    agent = make_agent()
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, agent)
        result = await session.run(user_input="What are the clinic timings?")
        await result.expect.contains_message(role="assistant").judge(judge_llm, intent="Gives the clinic timings.")
        assert not agent.state.end_call_requested
        result = await session.run(user_input="No, that's all. Thank you, bye!")
        await result.expect.contains_message(role="assistant").judge(judge_llm, intent="Says goodbye.")
        assert agent.state.end_call_requested


async def test_spoken_number_then_change_of_mind_books_nothing():
    repo = FakeRepo()
    day = next_open_day()
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent(repo))
        result = await session.run(
            user_input=f"Book Dr. Sharma on {day.isoformat()} at 9:30 AM. My name is Radha Krishna and my "
            "number is triple 9 triple 9 9999."
        )
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Reads back an appointment with Dr. Sharma at 9:30 AM including the mobile number "
            "9999999999 (in any digit grouping) and asks whether to book it.",
        )
        result = await session.run(user_input="No, I changed my mind. Don't book it.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm, intent="Confirms that nothing was booked, or that the booking was not made."
        )
        assert repo.appointments == {} and repo.book_calls == 0


async def test_asks_for_ten_digit_number_slowly():
    day = next_open_day()
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent())
        result = await session.run(
            user_input=f"Book Dr. Sharma on {day.isoformat()} at 9:30 AM. My name is Rahul Verma."
        )
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Asks for the patient's 10-digit mobile number and asks them to say it slowly.",
        )


async def test_taken_time_is_refused_with_alternatives():
    """Real call 2026-10-22: patient asked for an already-booked time and the agent said 'noted'."""
    repo = FakeRepo()
    day = next_open_day()
    from datetime import datetime, time
    from zoneinfo import ZoneInfo

    taken = datetime.combine(day, time(9, 15), tzinfo=ZoneInfo(CLINIC.timezone))
    await repo.book(CLINIC.id, SHARMA.id, taken, "Someone Else", "9123456789", "seed-key-2")
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent(repo))
        result = await session.run(user_input=f"I want Dr. Sharma on {day.isoformat()} at 9:15 AM.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Says 9:15 AM is not available and offers other times such as 9:00 AM or 9:30 AM. "
            "Does not accept or note 9:15 AM.",
        )


async def test_booking_asks_which_doctor():
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent())
        result = await session.run(user_input="Hi, my name is Rahul. I want to book an appointment for tomorrow.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Asks which doctor or specialty the patient wants (may name the doctors). Does not pick a "
            "doctor itself and does not offer specific time slots yet.",
        )


async def test_cancel_asks_which_doctor():
    repo = FakeRepo()
    day = next_open_day()
    from datetime import datetime, time
    from zoneinfo import ZoneInfo

    start = datetime.combine(day, time(9, 15), tzinfo=ZoneInfo(CLINIC.timezone))
    await repo.book(CLINIC.id, SHARMA.id, start, "Rahul Verma", "9876543210", "seed-key-3")
    async with (
        sarvam.LLM(model=receptionist.LLM_MODEL) as judge_llm,
        AgentSession() as session,
    ):
        await start_after_greeting(session, make_agent(repo))
        result = await session.run(user_input="I want to cancel my appointment. My name is Rahul Verma.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Asks which doctor the appointment is with, or asks for the mobile number."
            " Mentioning that the caller wants to cancel is fine; only a claim that the cancellation is already DONE fails.",
        )
        result = await session.run(user_input="My number is 9876543210.")
        await result.expect.contains_message(role="assistant").judge(
            judge_llm,
            intent="Asks which doctor the appointment is with, or (if the doctor was already asked) reads back "
            "the appointment with Dr. Sharma and asks whether to cancel it."
            " Mentioning that the caller wants to cancel is fine; only a claim that the cancellation is already DONE fails.",
        )
        assert repo.appointments["100000"]["status"] == "booked"
