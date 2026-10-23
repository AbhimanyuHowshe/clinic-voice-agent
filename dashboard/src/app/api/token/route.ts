import { randomBytes, timingSafeEqual } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoClinic } from "@/lib/clinics";

// Mints a short-lived LiveKit token for one patient voice session. The LiveKit secret stays
// on the server. The room name carries the clinic slug, which the agent uses to load the
// clinic; the agent is dispatched to the new room automatically.
export async function POST(request: NextRequest) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: "Voice service is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);

  // Optional shared demo code: when DEMO_ACCESS_CODE is set, calls need it (protects the
  // Sarvam/LiveKit credits behind a public link). Unset means the page is open.
  const expected = process.env.DEMO_ACCESS_CODE?.trim();
  if (expected) {
    const given = typeof body?.code === "string" ? body.code.trim() : "";
    const a = Buffer.from(given.toLowerCase());
    const b = Buffer.from(expected.toLowerCase());
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Please enter the correct demo access code." }, { status: 401 });
    }
  }

  const clinic = typeof body?.clinic === "string" ? body.clinic : null;
  if (!isDemoClinic(clinic)) {
    return NextResponse.json({ error: "Unknown clinic." }, { status: 400 });
  }

  const suffix = randomBytes(6).toString("hex");
  const roomName = `clinic-${clinic}-${suffix}`;
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: `patient-${suffix}`,
    name: "Patient",
    ttl: "15m",
  });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });

  return NextResponse.json(
    { serverUrl: LIVEKIT_URL, token: await token.toJwt(), roomName },
    { headers: { "Cache-Control": "no-store" } },
  );
}
