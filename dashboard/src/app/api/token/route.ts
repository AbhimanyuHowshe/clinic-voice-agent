import { randomBytes } from "node:crypto";
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
