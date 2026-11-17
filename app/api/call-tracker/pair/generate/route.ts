import { NextResponse } from "next/server";
import { requireApiRole } from "@/app/lib/api-auth";
import { generateDevicePairingCode } from "@/app/lib/call-tracker";

export async function POST() {
  try {
    await requireApiRole("ADMIN");
    const result = await generateDevicePairingCode();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : "Failed to generate pairing code";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}
