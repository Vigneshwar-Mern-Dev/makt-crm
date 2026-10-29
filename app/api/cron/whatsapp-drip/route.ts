import { NextResponse } from "next/server";
import { runWhatsAppDripReengagement } from "@/app/lib/whatsapp-drip";

function isAuthorized(request: Request) {
  const bridgeToken = process.env.WHATSAPP_BRIDGE_TOKEN;
  const headerToken =
    request.headers.get("x-whatsapp-bridge-token") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  return Boolean(bridgeToken && headerToken === bridgeToken);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWhatsAppDripReengagement();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[cron/whatsapp-drip] Execution error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
