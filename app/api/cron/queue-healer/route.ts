import { NextResponse } from "next/server";
import { healStuckQueueItems } from "@/app/lib/whatsapp-queue-healer";
import { validateBridgeRequest } from "@/app/lib/whatsapp-security";

export async function POST(request: Request) {
  const auth = validateBridgeRequest(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const result = await healStuckQueueItems();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[cron/queue-healer] Execution error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
