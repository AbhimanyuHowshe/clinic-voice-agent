"""Fill in agent/.env and dashboard/.env.local with hidden prompts.

Run it in your own terminal (not through Claude), from the agent folder:
    uv run python scripts/set_env.py

For each value it asks once, with hidden input, and writes it to every file that
needs it. Press Enter to skip a value and keep what is already there. Values are
never printed. Lines that aren't listed below are left unchanged.
"""

import getpass
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
AGENT_ENV = ROOT / "agent" / ".env"
DASHBOARD_ENV = ROOT / "dashboard" / ".env.local"

# (prompt label, [(file, variable name), ...])
VALUES = [
    ("LiveKit URL (wss://...livekit.cloud)", [(AGENT_ENV, "LIVEKIT_URL"), (DASHBOARD_ENV, "LIVEKIT_URL")]),
    ("LiveKit API key", [(AGENT_ENV, "LIVEKIT_API_KEY"), (DASHBOARD_ENV, "LIVEKIT_API_KEY")]),
    ("LiveKit API secret", [(AGENT_ENV, "LIVEKIT_API_SECRET"), (DASHBOARD_ENV, "LIVEKIT_API_SECRET")]),
    ("Sarvam API key", [(AGENT_ENV, "SARVAM_API_KEY")]),
    ("Supabase project URL (https://...supabase.co)", [(AGENT_ENV, "SUPABASE_URL"), (DASHBOARD_ENV, "NEXT_PUBLIC_SUPABASE_URL")]),
    ("Supabase SECRET key (sb_secret_... / service_role)", [(AGENT_ENV, "SUPABASE_SERVICE_ROLE_KEY")]),
    ("Supabase PUBLISHABLE key (sb_publishable_... / anon)", [(DASHBOARD_ENV, "NEXT_PUBLIC_SUPABASE_ANON_KEY")]),
]


def set_var(path: Path, name: str, value: str) -> None:
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    line = f"{name}={value}"
    pattern = re.compile(rf"^{re.escape(name)}=.*$", re.MULTILINE)
    if pattern.search(text):
        text = pattern.sub(lambda _: line, text, count=1)
    else:
        text = text.rstrip("\n") + ("\n" if text else "") + line + "\n"
    path.write_text(text, encoding="utf-8")


def clean(value: str) -> str:
    """Strip quotes and any pasted ``NAME=`` prefixes of our own variables (e.g. a whole .env line)."""
    known = {name for _, targets in VALUES for _, name in targets}
    value = value.strip().strip('"').strip("'")
    while "=" in value and value.split("=", 1)[0].strip() in known:
        value = value.split("=", 1)[1].strip().strip('"').strip("'")
    return value


def suspicious(value: str) -> str | None:
    """Catch pasted placeholders, several .env lines at once, or stray whitespace."""
    known = {name for _, targets in VALUES for _, name in targets}
    if "your-" in value or "your_" in value:
        return "it is still a placeholder from .env.example"
    if any(f"{name}=" in value for name in known):
        return "it contains a variable name, so several lines were probably pasted together"
    if any(ch.isspace() for ch in value):
        return "it contains spaces or line breaks"
    return None


def main() -> None:
    print("Paste each value and press Enter (input is hidden). Press Enter alone to skip.\n")
    for label, targets in VALUES:
        value = clean(getpass.getpass(f"{label}: "))
        if not value:
            print("  skipped")
            continue
        if problem := suspicious(value):
            print(f"  NOT saved: {problem}. Paste only the value itself.")
            continue
        for path, name in targets:
            set_var(path, name, value)
        print(f"  saved ({len(value)} characters) -> " + ", ".join(f"{p.parent.name}/{p.name}" for p, _ in targets))
    print("\nDone.")


if __name__ == "__main__":
    main()
