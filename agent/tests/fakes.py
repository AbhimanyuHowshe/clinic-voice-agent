"""In-memory stand-ins for the database and the chat model, for offline workflow tests."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from clinic.repository import Clinic, Doctor, Faq

TZ = "Asia/Kolkata"
CLINIC = Clinic(
    id="c1", slug="demo", name="Demo Clinic", timezone=TZ, voice_language="hi-IN",
    phone="+912000000000", address="1 Test Road",
)
SHARMA = Doctor(id="d1", name="Dr. Anjali Sharma", specialty="General Physician", slot_minutes=15)
MEHTA = Doctor(id="d2", name="Dr. Rohan Mehta", specialty="Pediatrician", slot_minutes=20)
FAQS = [Faq("What are the timings?", "9 AM to 1 PM.")]


def tomorrow() -> date:
    return datetime.now(ZoneInfo(TZ)).date() + timedelta(days=1)


def next_open_day() -> date:
    """Tomorrow, or the day after if tomorrow is Sunday (the fake clinic is closed Sundays)."""
    d = tomorrow()
    return d + timedelta(days=1) if d.weekday() == 6 else d


class FakeRepo:
    """Mimics the Postgres functions: real slot list, conflicts, idempotency, verification."""

    def __init__(self) -> None:
        self.available = True
        self.fail_next_writes = 0
        self.appointments: dict[str, dict[str, Any]] = {}
        self.by_key: dict[str, str] = {}
        self.book_calls = 0
        self._next_ref = 100000

    async def get_clinic(self, slug):
        return CLINIC

    async def list_doctors(self, clinic_id):
        return [SHARMA, MEHTA]

    async def list_faqs(self, clinic_id):
        return FAQS

    async def effective_state(self, clinic_id):
        return {"available": self.available, "reason": "available" if self.available else "manual_off"}

    def _all_slots(self, doctor_id: str, day: date) -> list[datetime]:
        if day.weekday() == 6:  # closed Sundays
            return []
        tz = ZoneInfo(TZ)
        minutes = 15 if doctor_id == "d1" else 20
        start = datetime.combine(day, time(9, 0), tzinfo=tz)
        return [start + timedelta(minutes=minutes * i) for i in range(4)]

    def _taken(self, doctor_id: str, ignore: str | None = None) -> set[datetime]:
        return {
            a["starts_at"] for ref, a in self.appointments.items()
            if a["doctor_id"] == doctor_id and a["status"] == "booked" and ref != ignore
        }

    async def available_slots(self, doctor_id, day):
        # Like the real database: instants come back in UTC, not clinic time.
        taken = self._taken(doctor_id)
        return [s.astimezone(timezone.utc) for s in self._all_slots(doctor_id, day) if s not in taken]

    def _json(self, ref: str) -> dict[str, Any]:
        a = self.appointments[ref]
        name = SHARMA.name if a["doctor_id"] == "d1" else MEHTA.name
        return {**a, "id": ref, "reference": ref, "doctor_name": name, "starts_at": a["starts_at"].isoformat()}

    def _maybe_fail(self) -> None:
        if self.fail_next_writes:
            self.fail_next_writes -= 1
            raise ConnectionError("simulated network failure")

    async def book(self, clinic_id, doctor_id, starts_at, name, phone, key):
        self.book_calls += 1
        self._maybe_fail()
        if key in self.by_key:
            return {"ok": True, "replayed": True, "appointment": self._json(self.by_key[key])}
        if not self.available:
            return {"ok": False, "error": "agent_unavailable"}
        if starts_at not in await self.available_slots(doctor_id, starts_at.date()):
            return {"ok": False, "error": "slot_unavailable"}
        ref = str(self._next_ref)
        self._next_ref += 1
        self.appointments[ref] = {
            "doctor_id": doctor_id, "starts_at": starts_at, "patient_name": name,
            "phone": phone, "status": "booked",
        }
        self.by_key[key] = ref
        return {"ok": True, "replayed": False, "appointment": self._json(ref)}

    @staticmethod
    def _key(phone):
        return "".join(ch for ch in phone if ch.isdigit())[-10:]

    def _verify(self, appointment_id, phone):
        a = self.appointments.get(appointment_id)
        if a is None or self._key(a["phone"]) != self._key(phone):
            return None
        return a

    async def find_by_phone(self, clinic_id, phone):
        return [
            self._json(ref) for ref, a in sorted(self.appointments.items(), key=lambda kv: kv[1]["starts_at"])
            if a["status"] == "booked" and self._key(a["phone"]) == self._key(phone)
        ]

    async def cancel(self, clinic_id, appointment_id, phone):
        self._maybe_fail()
        reference = appointment_id
        a = self._verify(reference, phone)
        if a is None:
            return {"ok": False, "error": "not_found"}
        if not self.available:
            return {"ok": False, "error": "agent_unavailable"}
        a["status"] = "cancelled"
        return {"ok": True, "appointment": self._json(reference)}

    async def reschedule(self, clinic_id, appointment_id, phone, new_starts_at):
        self._maybe_fail()
        reference = appointment_id
        a = self._verify(reference, phone)
        if a is None:
            return {"ok": False, "error": "not_found"}
        if new_starts_at in self._taken(a["doctor_id"], ignore=reference):
            return {"ok": False, "error": "slot_taken"}
        a["starts_at"] = new_starts_at
        return {"ok": True, "appointment": self._json(reference)}

    async def start_call(self, clinic_id, room_name):
        return "call1"

    async def finish_call(self, call_id, **fields):
        pass


class ScriptedChatModel(BaseChatModel):
    """Returns queued AIMessages in order; records what it was sent."""

    replies: list[AIMessage]
    seen: list[list] = []

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        self.seen.append(list(messages))
        return ChatResult(generations=[ChatGeneration(message=self.replies.pop(0))])
