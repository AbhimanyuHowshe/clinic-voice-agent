"""Create a staff login for the dashboard (public sign-up is disabled).

Run it in your own terminal from agent/ (the password prompt is hidden):
    uv run python scripts/create_staff.py

It creates the Supabase Auth user (email confirmed) and links it to a clinic as
'admin' or 'staff'. If the email already exists, only the clinic link and role are updated.
Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in agent/.env.
"""

import getpass
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def main() -> None:
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in agent/.env")
    db = create_client(url, key)

    clinics = db.table("clinics").select("id,slug,name").order("slug").execute().data
    if not clinics:
        sys.exit("No clinics found. Run: npx supabase db push --include-seed")
    for i, c in enumerate(clinics, 1):
        print(f"  {i}. {c['name']} ({c['slug']})")
    clinic = clinics[int(input("Clinic number: ").strip()) - 1]

    email = input("Staff email: ").strip().lower()
    full_name = input("Full name: ").strip()
    role = input("Role [admin/staff] (default admin): ").strip().lower() or "admin"
    if role not in ("admin", "staff"):
        sys.exit("Role must be admin or staff")

    existing = next((u for u in db.auth.admin.list_users(per_page=1000) if (u.email or "").lower() == email), None)
    if existing:
        user_id = existing.id
        print("User exists; updating clinic and role.")
    else:
        password = getpass.getpass("Password (min 8 characters, hidden): ")
        if len(password) < 8:
            sys.exit("Password too short")
        user_id = db.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        ).user.id

    db.table("profiles").upsert(
        {"id": user_id, "clinic_id": clinic["id"], "full_name": full_name, "role": role}
    ).execute()
    print(f"Done: {email} is {role} at {clinic['name']}.")


if __name__ == "__main__":
    main()
