"""Offline tests for the receptionist workflow: tool guards and graph routing.

No network: the database and the chat model are in-memory fakes (tests/fakes.py).
"""

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from clinic.workflow import (
    SessionState,
    build_graph,
    build_instructions,
    build_tools,
    detect_language,
    match_doctor,
    normalize_phone,
    summarize_slots,
    parse_time,
)
from tests.fakes import CLINIC, FAQS, MEHTA, SHARMA, FakeRepo, ScriptedChatModel, next_open_day


def make_state(repo=None) -> SessionState:
    return SessionState(clinic=CLINIC, doctors=[SHARMA, MEHTA], faqs=FAQS, repo=repo or FakeRepo())


def tools_by_name(state):
    return {t.name: t for t in build_tools(state)}


BOOK_ARGS = lambda: {  # noqa: E731
    "doctor": "Sharma", "date": next_open_day().isoformat(), "time": "09:15",
    "patient_name": "Rahul Verma", "patient_phone": "98765 43210",
}


# --- parsing --------------------------------------------------------------------------


def test_match_doctor_by_name_and_specialty():
    docs = [SHARMA, MEHTA]
    assert match_doctor(docs, "Dr. Sharma") == [SHARMA]
    assert match_doctor(docs, "pediatrician") == [MEHTA]
    assert match_doctor(docs, "dermatologist") == []


@pytest.mark.parametrize("raw,ok", [("9876543210", True), ("+91 98765-43210", True), ("12345", False), ("abc", False)])
def test_normalize_phone(raw, ok):
    assert (normalize_phone(raw) is not None) == ok


@pytest.mark.parametrize("text,lang", [
    ("I want to see a doctor tomorrow", "English"),
    ("मुझे डॉक्टर से मिलना है", "Hindi"),
    ("Clinic kitne baje khulta hai?", "Hindi"),
    ("Mujhe kal appointment chahiye", "Hindi"),
    ("Yes, please book it.", "English"),
    # Short fragments are ambiguous: keep the current language.
    ("3 बजे", None),
    ("Doctor Anjali.", None),
    ("999.", None),
    ("Radhe Radhe.", None),
])
def test_detect_language(text, lang):
    assert detect_language(text) == lang


@pytest.mark.parametrize("raw,expected", [
    ("09:15", "09:15"), ("9.15", "09:15"), ("09:15:00", "09:15"), ("17:30", "17:30"),
    ("10 AM", "10:00"), ("10am", "10:00"), ("5:30 PM", "17:30"), ("12 pm", "12:00"), ("12:15 a.m.", "00:15"),
])
def test_parse_time_accepts_common_forms(raw, expected):
    assert parse_time(raw).strftime("%H:%M") == expected


@pytest.mark.parametrize("raw", ["25:00", "nine", "10", "13 PM", ""])
def test_parse_time_rejects(raw):
    assert parse_time(raw) is None


def test_slot_summary_shows_gaps_as_ranges():
    from datetime import datetime as dt, timedelta as td
    from zoneinfo import ZoneInfo

    base = dt(2026, 10, 23, 9, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    morning = [base + td(minutes=15 * i) for i in range(16)]  # 9:00-12:45
    evening = [base + td(hours=8) + td(minutes=15 * i) for i in range(12)]  # 17:00-19:45
    text = summarize_slots(morning + evening)
    assert "every 15 minutes from 9:00 AM to 12:45 PM, and from 5:00 PM to 7:45 PM" in text
    assert "NOT free" in text
    few = summarize_slots(morning[:3])
    assert "9:00 AM, 9:15 AM and 9:30 AM" in few


async def test_language_sticks_through_short_replies():
    from tests.fakes import ScriptedChatModel

    state = make_state()
    model = ScriptedChatModel(replies=[AIMessage(content="ok")] * 3, seen=[])
    graph = build_graph(model, state)
    history = [HumanMessage("मुझे कल डॉक्टर से मिलना है")]
    await graph.ainvoke({"messages": history})
    assert state.language == "Hindi"
    history += [AIMessage("जी"), HumanMessage("3 PM")]
    await graph.ainvoke({"messages": history})
    assert state.language == "Hindi" and "Devanagari" in model.seen[-1][-1].content
    history += [AIMessage("ठीक है"), HumanMessage("Sorry, can we speak in English please?")]
    await graph.ainvoke({"messages": history})
    assert state.language == "English"


async def test_slots_are_spoken_in_clinic_time_not_utc():
    state = make_state()
    tools = tools_by_name(state)
    out = await tools["check_availability"].ainvoke({"doctor": "Sharma", "date": next_open_day().isoformat()})
    assert "9:00 AM" in out and "3:30 AM" not in out  # 09:00 IST is 03:30 UTC
    held = await tools["prepare_booking"].ainvoke({**BOOK_ARGS(), "time": "9:15 AM"})
    assert "at 9:15 AM" in held


# --- availability ---------------------------------------------------------------------


async def test_check_availability_offers_only_real_slots():
    tools = tools_by_name(make_state())
    out = await tools["check_availability"].ainvoke({"doctor": "Sharma", "date": next_open_day().isoformat()})
    assert "9:00 AM" in out and "9:45 AM" in out and "10:00 AM" not in out


async def test_check_availability_rejects_past_and_bad_dates():
    tools = tools_by_name(make_state())
    assert "YYYY-MM-DD" in await tools["check_availability"].ainvoke({"doctor": "Sharma", "date": "2020-01-01"})
    assert "YYYY-MM-DD" in await tools["check_availability"].ainvoke({"doctor": "Sharma", "date": "tomorrow"})


async def test_check_availability_unknown_doctor_lists_doctors():
    tools = tools_by_name(make_state())
    out = await tools["check_availability"].ainvoke({"doctor": "cardiologist", "date": next_open_day().isoformat()})
    assert "No doctor matches" in out and "Dr. Rohan Mehta" in out


# --- booking requires confirmation in a later turn -----------------------------------


async def test_booking_needs_patient_turn_before_confirm():
    repo = FakeRepo()
    state = make_state(repo)
    tools = tools_by_name(state)
    state.turn = 3
    held = await tools["prepare_booking"].ainvoke(BOOK_ARGS())
    assert "NOT booked" in held and repo.book_calls == 0

    # Same turn: the model tries to confirm without the patient answering.
    refused = await tools["confirm_pending_action"].ainvoke({})
    assert "not confirmed yet" in refused and repo.book_calls == 0

    state.turn = 4  # patient said yes
    done = await tools["confirm_pending_action"].ainvoke({})
    assert done.startswith("BOOKED") and "same phone number" in done
    assert len(repo.appointments) == 1 and state.pending is None


async def test_re_preparing_same_booking_keeps_the_hold():
    repo = FakeRepo()
    state = make_state(repo)
    tools = tools_by_name(state)
    state.turn = 1
    await tools["prepare_booking"].ainvoke(BOOK_ARGS())
    key = state.pending.idempotency_key
    state.turn = 2  # patient said yes; the model re-prepares before confirming
    await tools["prepare_booking"].ainvoke(BOOK_ARGS())
    assert state.pending.prepared_turn == 1 and state.pending.idempotency_key == key
    assert (await tools["confirm_pending_action"].ainvoke({})).startswith("BOOKED")

    # A changed request is a new hold that needs its own yes.
    await tools["prepare_booking"].ainvoke({**BOOK_ARGS(), "time": "09:30"})
    assert state.pending.prepared_turn == 2
    assert "not confirmed yet" in await tools["confirm_pending_action"].ainvoke({})


async def test_confirm_without_pending_does_nothing():
    repo = FakeRepo()
    tools = tools_by_name(make_state(repo))
    assert "Nothing is waiting" in await tools["confirm_pending_action"].ainvoke({})
    assert repo.book_calls == 0


async def test_prepare_booking_rejects_unavailable_time_and_bad_details():
    tools = tools_by_name(make_state())
    args = BOOK_ARGS()
    assert "not free" in await tools["prepare_booking"].ainvoke({**args, "time": "15:00"})
    assert "phone number looks wrong" in await tools["prepare_booking"].ainvoke({**args, "patient_phone": "123"})
    assert "name" in await tools["prepare_booking"].ainvoke({**args, "patient_name": " "})


async def test_slot_taken_between_prepare_and_confirm():
    repo = FakeRepo()
    a, b = make_state(repo), make_state(repo)
    ta, tb = tools_by_name(a), tools_by_name(b)
    await ta["prepare_booking"].ainvoke(BOOK_ARGS())
    await tb["prepare_booking"].ainvoke({**BOOK_ARGS(), "patient_name": "Other Patient"})
    a.turn = b.turn = 1
    assert (await ta["confirm_pending_action"].ainvoke({})).startswith("BOOKED")
    second = await tb["confirm_pending_action"].ainvoke({})
    assert "no longer available" in second and "Nothing was changed" in second
    assert len(repo.appointments) == 1


async def test_retry_after_network_failure_does_not_double_book():
    repo = FakeRepo()
    state = make_state(repo)
    tools = tools_by_name(state)
    await tools["prepare_booking"].ainvoke(BOOK_ARGS())
    state.turn = 1
    repo.fail_next_writes = 1
    failed = await tools["confirm_pending_action"].ainvoke({})
    assert "NOT confirmed" in failed and state.pending is not None
    key = state.pending.idempotency_key
    assert (await tools["confirm_pending_action"].ainvoke({})).startswith("BOOKED")
    assert len(repo.appointments) == 1 and repo.by_key == {key: "100000"}


async def test_switched_off_mid_call_blocks_changes():
    repo = FakeRepo()
    state = make_state(repo)
    tools = tools_by_name(state)
    await tools["prepare_booking"].ainvoke(BOOK_ARGS())
    state.turn = 1
    repo.available = False
    out = await tools["confirm_pending_action"].ainvoke({})
    assert "switched off" in out and repo.book_calls == 0 and not state.changes_allowed


# --- cancel and reschedule ------------------------------------------------------------


async def book_one(repo) -> str:
    state = make_state(repo)
    tools = tools_by_name(state)
    await tools["prepare_booking"].ainvoke(BOOK_ARGS())
    state.turn = 1
    await tools["confirm_pending_action"].ainvoke({})
    return "100000"


async def test_cancel_finds_by_phone_and_needs_confirmation():
    repo = FakeRepo()
    ref = await book_one(repo)
    state = make_state(repo)
    tools = tools_by_name(state)
    assert "find_appointments" in await tools["prepare_cancellation"].ainvoke({"appointment_number": 1})

    wrong = await tools["find_appointments"].ainvoke({"patient_phone": "9999999999", "purpose": "check"})
    assert "No upcoming appointments" in wrong
    assert "find_appointments" in await tools["prepare_cancellation"].ainvoke({"appointment_number": 1})

    found = await tools["find_appointments"].ainvoke({"patient_phone": "+91 98765 43210", "purpose": "check"})
    assert "One upcoming appointment" in found and "Dr. Anjali Sharma" in found
    assert "from 1 to 1" in await tools["prepare_cancellation"].ainvoke({"appointment_number": 2})
    assert state.pending is None
    held = await tools["prepare_cancellation"].ainvoke({"appointment_number": 1})
    assert "NOT cancelled" in held
    assert repo.appointments[ref]["status"] == "booked"
    state.turn = 1
    assert (await tools["confirm_pending_action"].ainvoke({})).startswith("CANCELLED")
    assert repo.appointments[ref]["status"] == "cancelled"


async def test_find_for_cancel_with_one_appointment_holds_it():
    repo = FakeRepo()
    await book_one(repo)
    state = make_state(repo)
    tools = tools_by_name(state)
    state.turn = 1
    out = await tools["find_appointments"].ainvoke({"patient_phone": "9876543210", "purpose": "cancel"})
    assert "NOT cancelled" in out and state.pending.kind == "cancel" and state.pending.prepared_turn == 1
    state.turn = 2
    assert (await tools["confirm_pending_action"].ainvoke({})).startswith("CANCELLED")


async def test_reschedule_to_free_slot():
    repo = FakeRepo()
    ref = await book_one(repo)
    state = make_state(repo)
    tools = tools_by_name(state)
    day = next_open_day().isoformat()
    await tools["find_appointments"].ainvoke({"patient_phone": "9876543210", "purpose": "reschedule"})
    held = await tools["prepare_reschedule"].ainvoke({"appointment_number": 1, "new_date": day, "new_time": "09:30"})
    assert "NOT changed" in held
    state.turn = 1
    assert (await tools["confirm_pending_action"].ainvoke({})).startswith("RESCHEDULED")
    assert repo.appointments[ref]["starts_at"].strftime("%H:%M") == "09:30"


# --- escalation -----------------------------------------------------------------------


async def test_escalation_records_reason_and_phone():
    state = make_state()
    tools = tools_by_name(state)
    out = await tools["escalate_to_staff"].ainvoke({"reason": "billing question", "callback_phone": "9876543210"})
    assert "call them back" in out
    assert state.escalation_reason == "billing question" and state.callback_phone == "9876543210"
    assert state.actions == ["escalate"]


# --- graph routing --------------------------------------------------------------------


def tool_call(name, args, id_="call_1"):
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": id_, "type": "tool_call"}])


async def test_graph_routes_tool_call_then_answers():
    state = make_state()
    model = ScriptedChatModel(replies=[
        tool_call("check_availability", {"doctor": "Sharma", "date": next_open_day().isoformat()}),
        AIMessage(content="Dr. Sharma is free at 9 AM. Which time suits you?"),
    ], seen=[])
    graph = build_graph(model, state)
    out = await graph.ainvoke({"messages": [SystemMessage("sys"), HumanMessage("Book Dr Sharma tomorrow")]})
    msgs = out["messages"]
    assert isinstance(msgs[-2], ToolMessage) and "9:00 AM" in msgs[-2].content
    assert msgs[-1].content.startswith("Dr. Sharma is free")
    assert state.turn == 1


async def test_graph_plain_faq_answer_skips_tools():
    state = make_state()
    model = ScriptedChatModel(replies=[AIMessage(content="We are open 9 AM to 1 PM.")], seen=[])
    out = await build_graph(model, state).ainvoke({"messages": [HumanMessage("Timings?")]})
    assert [type(m).__name__ for m in out["messages"]] == ["HumanMessage", "AIMessage"]


async def test_graph_same_turn_confirm_is_refused():
    repo = FakeRepo()
    state = make_state(repo)
    args = BOOK_ARGS()
    model = ScriptedChatModel(replies=[
        tool_call("prepare_booking", args, "c1"),
        tool_call("confirm_pending_action", {}, "c2"),
        AIMessage(content="Shall I book this?"),
    ], seen=[])
    out = await build_graph(model, state).ainvoke({"messages": [HumanMessage("book it")]})
    confirm_result = [m for m in out["messages"] if isinstance(m, ToolMessage)][-1]
    assert "not confirmed yet" in confirm_result.content and repo.book_calls == 0


def test_instructions_ground_faqs_and_doctors():
    text = build_instructions(make_state())
    assert "9 AM to 1 PM." in text and "Dr. Rohan Mehta, Pediatrician" in text
    assert "112" in text and "not a medical professional" in text
