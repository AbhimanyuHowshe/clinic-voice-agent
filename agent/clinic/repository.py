"""Data access for the voice agent.

All booking changes go through Postgres functions (see supabase/migrations), which enforce
availability, double-booking prevention and idempotency. This module only calls them.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Protocol

import httpx
from supabase import AsyncClient, acreate_client

logger = logging.getLogger("clinic.repository")


@dataclass(frozen=True)
class Clinic:
    id: str
    slug: str
    name: str
    timezone: str
    voice_language: str
    phone: str | None
    address: str | None
    country: str = "IN"


@dataclass(frozen=True)
class Doctor:
    id: str
    name: str
    specialty: str
    slot_minutes: int


@dataclass(frozen=True)
class Faq:
    question: str
    answer: str


class Repository(Protocol):
    """What the agent needs from the backend. Tests use an in-memory fake."""

    async def get_clinic(self, slug: str) -> Clinic | None: ...
    async def list_doctors(self, clinic_id: str) -> list[Doctor]: ...
    async def list_faqs(self, clinic_id: str) -> list[Faq]: ...
    async def effective_state(self, clinic_id: str) -> dict[str, Any]: ...
    async def available_slots(self, doctor_id: str, day: date) -> list[datetime]: ...
    async def book(
        self, clinic_id: str, doctor_id: str, starts_at: datetime, name: str, phone: str, key: str
    ) -> dict[str, Any]: ...
    async def find_by_phone(self, clinic_id: str, phone: str) -> list[dict[str, Any]]: ...
    async def cancel(self, clinic_id: str, appointment_id: str, phone: str) -> dict[str, Any]: ...
    async def reschedule(
        self, clinic_id: str, appointment_id: str, phone: str, new_starts_at: datetime
    ) -> dict[str, Any]: ...
    async def start_call(self, clinic_id: str, room_name: str) -> str | None: ...
    async def finish_call(self, call_id: str, **fields: Any) -> None: ...


# Transient network failures are retried. Every write function is idempotent server-side
# (idempotency key for bookings; cancel/reschedule report success on replay).
_RETRYABLE = (httpx.TransportError, httpx.TimeoutException)


async def _with_retry(fn, attempts: int = 3, delay: float = 0.4):
    for attempt in range(1, attempts + 1):
        try:
            return await fn()
        except _RETRYABLE as e:
            if attempt == attempts:
                raise
            logger.warning("supabase call failed (%s), retrying %d/%d", type(e).__name__, attempt, attempts)
            await asyncio.sleep(delay * attempt)


class SupabaseRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    @classmethod
    async def from_env(cls) -> SupabaseRepository:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return cls(await acreate_client(url, key))

    async def _rpc(self, name: str, params: dict[str, Any]) -> Any:
        return (await _with_retry(lambda: self._db.rpc(name, params).execute())).data

    async def get_clinic(self, slug: str) -> Clinic | None:
        res = await _with_retry(
            lambda: self._db.table("clinics")
            .select("id,slug,name,timezone,voice_language,phone,address,country")
            .eq("slug", slug)
            .limit(1)
            .execute()
        )
        return Clinic(**res.data[0]) if res.data else None

    async def list_doctors(self, clinic_id: str) -> list[Doctor]:
        res = await _with_retry(
            lambda: self._db.table("doctors")
            .select("id,name,specialty,slot_minutes")
            .eq("clinic_id", clinic_id)
            .eq("active", True)
            .order("name")
            .execute()
        )
        return [Doctor(**row) for row in res.data]

    async def list_faqs(self, clinic_id: str) -> list[Faq]:
        res = await _with_retry(
            lambda: self._db.table("clinic_faqs")
            .select("question,answer")
            .eq("clinic_id", clinic_id)
            .eq("active", True)
            .execute()
        )
        return [Faq(**row) for row in res.data]

    async def effective_state(self, clinic_id: str) -> dict[str, Any]:
        return await self._rpc("agent_effective_state", {"p_clinic_id": clinic_id})

    async def available_slots(self, doctor_id: str, day: date) -> list[datetime]:
        rows = await self._rpc("available_slots", {"p_doctor_id": doctor_id, "p_day": day.isoformat()})
        return [datetime.fromisoformat(r["starts_at"]) for r in rows]

    async def book(self, clinic_id, doctor_id, starts_at, name, phone, key):
        return await self._rpc(
            "book_appointment",
            {
                "p_clinic_id": clinic_id,
                "p_doctor_id": doctor_id,
                "p_starts_at": starts_at.isoformat(),
                "p_patient_name": name,
                "p_patient_phone": phone,
                "p_idempotency_key": key,
            },
        )

    async def find_by_phone(self, clinic_id, phone):
        """Upcoming booked appointments for this phone number, earliest first."""
        return await self._rpc("find_appointments_by_phone", {"p_clinic_id": clinic_id, "p_phone": phone})

    async def cancel(self, clinic_id, appointment_id, phone):
        return await self._rpc(
            "cancel_appointment",
            {"p_clinic_id": clinic_id, "p_appointment_id": appointment_id, "p_phone": phone},
        )

    async def reschedule(self, clinic_id, appointment_id, phone, new_starts_at):
        return await self._rpc(
            "reschedule_appointment",
            {
                "p_clinic_id": clinic_id,
                "p_appointment_id": appointment_id,
                "p_phone": phone,
                "p_new_starts_at": new_starts_at.isoformat(),
            },
        )

    async def start_call(self, clinic_id: str, room_name: str) -> str | None:
        res = await _with_retry(
            lambda: self._db.table("call_logs").insert({"clinic_id": clinic_id, "room_name": room_name}).execute()
        )
        return res.data[0]["id"] if res.data else None

    async def finish_call(self, call_id: str, **fields: Any) -> None:
        await _with_retry(lambda: self._db.table("call_logs").update(fields).eq("id", call_id).execute())
