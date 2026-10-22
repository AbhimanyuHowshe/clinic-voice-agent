"""Integration tests against the real Supabase database functions.

Creates a throwaway clinic (slug "test-<random>"), runs the checks, then deletes it.
Skipped unless RUN_DB_TESTS=1 and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set.

Run: RUN_DB_TESTS=1 uv run pytest tests/test_db.py -v
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from dotenv import load_dotenv

load_dotenv()

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_DB_TESTS") != "1" or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
    reason="live database test; set RUN_DB_TESTS=1 and Supabase credentials",
)

TZ = ZoneInfo("Asia/Kolkata")
PHONE = "+919876543210"


@pytest.fixture
async def env():
    from clinic.repository import SupabaseRepository

    repo = await SupabaseRepository.from_env()
    db = repo._db
    slug = f"test-{uuid.uuid4().hex[:8]}"
    clinic = (await db.table("clinics").insert(
        {"slug": slug, "name": "Test Clinic", "timezone": "Asia/Kolkata", "country": "IN"}
    ).execute()).data[0]
    doctor = (await db.table("doctors").insert(
        {"clinic_id": clinic["id"], "name": "Dr. Test", "slot_minutes": 15}
    ).execute()).data[0]
    await db.table("doctor_schedules").insert(
        [{"doctor_id": doctor["id"], "weekday": d, "start_time": "09:00", "end_time": "10:00"} for d in range(7)]
    ).execute()
    try:
        yield repo, db, clinic["id"], doctor["id"]
    finally:
        await db.table("appointments").delete().eq("clinic_id", clinic["id"]).execute()
        await db.table("clinics").delete().eq("id", clinic["id"]).execute()


def tomorrow_at(h: int, m: int) -> datetime:
    day = datetime.now(TZ).date() + timedelta(days=1)
    return datetime(day.year, day.month, day.day, h, m, tzinfo=TZ)


async def test_slots_come_from_schedule(env):
    repo, _, _, doctor_id = env
    slots = await repo.available_slots(doctor_id, tomorrow_at(9, 0).date())
    assert [s.astimezone(TZ).strftime("%H:%M") for s in slots] == ["09:00", "09:15", "09:30", "09:45"]


async def test_booking_is_idempotent_and_blocks_the_slot(env):
    repo, _, clinic_id, doctor_id = env
    at = tomorrow_at(9, 15)
    first = await repo.book(clinic_id, doctor_id, at, "Rahul", PHONE, "key-aaaaaaaa")
    assert first["ok"] and not first["replayed"] and len(first["appointment"]["reference"]) == 6
    again = await repo.book(clinic_id, doctor_id, at, "Rahul", PHONE, "key-aaaaaaaa")
    assert again["ok"] and again["replayed"]
    assert again["appointment"]["reference"] == first["appointment"]["reference"]
    other = await repo.book(clinic_id, doctor_id, at, "Someone", PHONE, "key-bbbbbbbb")
    assert other == {"ok": False, "error": "slot_unavailable"}
    slots = await repo.available_slots(doctor_id, at.date())
    assert at not in slots


async def test_concurrent_bookings_only_one_wins(env):
    repo, _, clinic_id, doctor_id = env
    at = tomorrow_at(9, 30)
    results = await asyncio.gather(*[
        repo.book(clinic_id, doctor_id, at, f"Patient {i}", PHONE, f"race-{i}-{uuid.uuid4().hex}")
        for i in range(6)
    ])
    assert sum(r["ok"] for r in results) == 1
    assert {r["error"] for r in results if not r["ok"]} <= {"slot_taken", "slot_unavailable"}


async def test_rejects_invented_or_invalid_slots(env):
    repo, _, clinic_id, doctor_id = env
    off_grid = await repo.book(clinic_id, doctor_id, tomorrow_at(9, 7), "Rahul", PHONE, "key-cccccccc")
    assert off_grid["error"] == "slot_unavailable"
    outside = await repo.book(clinic_id, doctor_id, tomorrow_at(14, 0), "Rahul", PHONE, "key-dddddddd")
    assert outside["error"] == "slot_unavailable"
    bad_phone = await repo.book(clinic_id, doctor_id, tomorrow_at(9, 0), "Rahul", "12", "key-eeeeeeee")
    assert bad_phone["error"] == "invalid_phone"


async def test_cancel_and_reschedule_need_matching_phone(env):
    repo, _, clinic_id, doctor_id = env
    booked = await repo.book(clinic_id, doctor_id, tomorrow_at(9, 0), "Rahul", PHONE, "key-ffffffff")
    appt_id = booked["appointment"]["id"]

    assert await repo.find_by_phone(clinic_id, "9999999999") == []
    assert (await repo.cancel(clinic_id, appt_id, "9999999999"))["error"] == "not_found"
    found = await repo.find_by_phone(clinic_id, "98765 43210")
    assert [a["id"] for a in found] == [appt_id] and found[0]["doctor_name"] == "Dr. Test"

    moved = await repo.reschedule(clinic_id, appt_id, PHONE, tomorrow_at(9, 45))
    assert moved["ok"]
    assert datetime.fromisoformat(moved["appointment"]["starts_at"]) == tomorrow_at(9, 45)
    assert tomorrow_at(9, 0) in await repo.available_slots(doctor_id, tomorrow_at(9, 0).date())

    cancelled = await repo.cancel(clinic_id, appt_id, PHONE)
    assert cancelled["ok"] and cancelled["appointment"]["status"] == "cancelled"
    assert (await repo.cancel(clinic_id, appt_id, PHONE))["replayed"]
    assert await repo.find_by_phone(clinic_id, PHONE) == []  # only upcoming booked ones are listed


async def state_at(db, clinic_id, at: datetime) -> str:
    res = await db.rpc("agent_effective_state", {"p_clinic_id": clinic_id, "p_at": at.isoformat()}).execute()
    return res.data["reason"]


async def test_effective_state_precedence_and_overnight_schedule(env):
    repo, db, clinic_id, doctor_id = env
    # 2026-10-26 is a Monday (weekday 1).
    mon = lambda h, m=0: datetime(2026, 10, 26, h, m, tzinfo=TZ)  # noqa: E731

    assert await state_at(db, clinic_id, mon(3)) == "available"  # schedule not enabled yet

    await db.table("agent_settings").update({"schedule_enabled": True}).eq("clinic_id", clinic_id).execute()
    await db.table("agent_schedules").insert([
        {"clinic_id": clinic_id, "weekday": 1, "start_time": "09:00", "end_time": "13:00"},
        {"clinic_id": clinic_id, "weekday": 1, "start_time": "20:00", "end_time": "02:00"},  # overnight
    ]).execute()
    assert await state_at(db, clinic_id, mon(8, 59)) == "outside_hours"
    assert await state_at(db, clinic_id, mon(9)) == "available"
    assert await state_at(db, clinic_id, mon(13)) == "outside_hours"  # end is exclusive
    assert await state_at(db, clinic_id, mon(23, 30)) == "available"
    assert await state_at(db, clinic_id, mon(23, 30) + timedelta(hours=2)) == "available"  # Tue 01:30
    assert await state_at(db, clinic_id, mon(23, 30) + timedelta(hours=3)) == "outside_hours"  # Tue 02:30

    await db.table("temporary_pauses").insert({
        "clinic_id": clinic_id, "starts_at": mon(10).isoformat(), "ends_at": mon(11).isoformat(),
    }).execute()
    assert await state_at(db, clinic_id, mon(10, 30)) == "paused"
    assert await state_at(db, clinic_id, mon(11)) == "available"

    await db.table("clinic_holidays").insert({"clinic_id": clinic_id, "day": "2026-10-26"}).execute()
    assert await state_at(db, clinic_id, mon(10, 30)) == "holiday"

    await db.table("agent_settings").update({"manual_enabled": False}).eq("clinic_id", clinic_id).execute()
    assert await state_at(db, clinic_id, mon(10, 30)) == "manual_off"


async def test_booking_refused_when_agent_switched_off(env):
    repo, db, clinic_id, doctor_id = env
    await db.table("agent_settings").update({"manual_enabled": False}).eq("clinic_id", clinic_id).execute()
    res = await repo.book(clinic_id, doctor_id, tomorrow_at(9, 0), "Rahul", PHONE, "key-gggggggg")
    assert res == {"ok": False, "error": "agent_unavailable"}


async def test_settings_changes_are_audited(env):
    _, db, clinic_id, _ = env
    await db.table("agent_settings").update({"manual_enabled": False}).eq("clinic_id", clinic_id).execute()
    logs = (await db.table("audit_logs").select("action,table_name,new_data")
            .eq("clinic_id", clinic_id).eq("table_name", "agent_settings").execute()).data
    assert any(l["action"] == "update" and l["new_data"]["manual_enabled"] is False for l in logs)


async def test_appointment_audit_omits_patient_details(env):
    repo, db, clinic_id, doctor_id = env
    await repo.book(clinic_id, doctor_id, tomorrow_at(9, 0), "Rahul", PHONE, "key-hhhhhhhh")
    logs = (await db.table("audit_logs").select("new_data")
            .eq("clinic_id", clinic_id).eq("table_name", "appointments").execute()).data
    assert logs and all("patient_phone" not in l["new_data"] and "patient_name" not in l["new_data"] for l in logs)
