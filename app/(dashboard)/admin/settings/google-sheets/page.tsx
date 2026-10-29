export const dynamic = "force-dynamic";

import Link from "next/link";
import { getGoogleSheetsIntegrationAction } from "@/app/lib/google-sheets-actions";
import { GoogleSheetsClient } from "./google-sheets-client";

export default async function GoogleSheetsSettingsPage() {
  const result = await getGoogleSheetsIntegrationAction();

  if ("error" in result || !result.org) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        Failed to load Google Sheets integration settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Integrations &amp; Automation
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Google Sheets Synchronization
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Connect Google Sheets with {result.org.name} to automatically push telecaller-qualified leads and receive inbound records via Google Apps Script.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/settings"
              className="h-10 rounded-xl border border-white/10 px-4 text-xs font-semibold leading-10 text-slate-300 transition hover:bg-white/10"
            >
              Settings Hub
            </Link>
            <Link
              href="/admin/settings/developer"
              className="h-10 rounded-xl border border-white/10 px-4 text-xs font-semibold leading-10 text-slate-300 transition hover:bg-white/10"
            >
              API Keys
            </Link>
          </div>
        </div>
      </section>

      {/* Main interactive manager */}
      <GoogleSheetsClient
        initialIntegration={result.integration}
        orgName={result.org.name}
        orgApiKey={result.org.apiKey}
        crmBaseUrl={result.crmBaseUrl}
      />
    </div>
  );
}

