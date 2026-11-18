import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    latestVersion: "3.0",
    versionCode: 5,
    downloadUrl: "https://crm.planle.com/downloads/makt-tracker.apk",
    changelog: "Planle CRM v3.0: High-speed auto-sync, dual V1+V2 security signing, daily talk-time analytics, and instant customer redial.",
    mandatory: false,
  });
}
