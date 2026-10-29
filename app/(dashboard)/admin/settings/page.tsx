export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireOrgUser } from "@/app/lib/org-session";
import { db } from "@/app/lib/db";
import { LeadSource } from "@/app/lib/prisma-enums";
import { ChangePasswordForm } from "./change-password-form";

export default async function AdminSettingsPage() {
  const { user, org } = await requireOrgUser();

  const [totalMembers, adminCount, sheetIntegration] = await Promise.all([
    db.orgMember.count({ where: { organizationId: org.id } }),
    db.orgMember.count({ where: { organizationId: org.id, role: { in: ["ADMIN", "OWNER"] } } }),
    db.leadIntegration.findFirst({
      where: { organizationId: org.id, source: LeadSource.CALLS },
      select: { status: true, sheetName: true, importedCount: true },
    }),
  ]);

  const agentCount = Math.max(0, totalMembers - adminCount);

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
          {org.name} Workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Settings Hub
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Configure multi-tenant organization settings, Google Sheets synchronization, lead distribution rules, team access, and developer APIs.
        </p>
      </section>

      {/* Quick Settings Modules */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/settings/google-sheets"
          className="group rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] via-white/[0.01] to-transparent p-5 backdrop-blur-md transition-all duration-300 hover:border-emerald-400/40 hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Integration</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                sheetIntegration?.status === "CONNECTED"
                  ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                  : "bg-slate-500/20 text-slate-300 border border-slate-500/30"
              }`}
            >
              {sheetIntegration?.status === "CONNECTED" ? "Connected" : "Not Configured"}
            </span>
          </div>
          <h3 className="mt-3 text-base font-bold text-white group-hover:text-emerald-300 transition">Google Sheets Sync</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Push qualified leads automatically via Apps Script with 1-click update confirmation.
          </p>
        </Link>

        <Link
          href="/admin/settings/lead-distribution"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-cyan-400/30 hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Routing</span>
            <span className="text-xs font-bold text-slate-400">Automated</span>
          </div>
          <h3 className="mt-3 text-base font-bold text-white group-hover:text-cyan-300 transition">Lead Distribution &amp; SLA</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Configure round-robin, agent online availability status, and auto-reassignment timers.
          </p>
        </Link>

        <Link
          href="/admin/settings/members"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-violet-400/30 hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Team</span>
            <span className="text-xs font-bold text-slate-400">{totalMembers} Members</span>
          </div>
          <h3 className="mt-3 text-base font-bold text-white group-hover:text-violet-300 transition">Members &amp; Invites</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Invite telecallers, assign roles, or create colleague credentials directly.
          </p>
        </Link>

        <Link
          href="/admin/settings/developer"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-sky-400/30 hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Developer</span>
            <span className="text-xs font-bold text-slate-400">REST API</span>
          </div>
          <h3 className="mt-3 text-base font-bold text-white group-hover:text-sky-300 transition">API Keys &amp; Ingestion</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Get your organization API key to ingest leads from external landing pages and ad funnels.
          </p>
        </Link>

        <Link
          href="/admin/settings/organization"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-amber-400/30 hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Organization</span>
            <span className="text-xs font-bold text-slate-400">{org.slug}</span>
          </div>
          <h3 className="mt-3 text-base font-bold text-white group-hover:text-amber-300 transition">Profile &amp; Branding</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Update your organization display name, slug, and company logo.
          </p>
        </Link>

        <Link
          href="/admin/whatsapp/settings"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-emerald-400/30 hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Outreach</span>
            <span className="text-xs font-bold text-slate-400">Anti-Ban</span>
          </div>
          <h3 className="mt-3 text-base font-bold text-white group-hover:text-emerald-300 transition">WhatsApp Rules</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Configure quiet hours, sending limits, warmup ramp, and SpinTax message templates.
          </p>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Security overview */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white">Security &amp; Policy</h2>
          <div className="mt-5 space-y-3">
            {[
              ["Session duration", "7 days (cookie-based HMAC-SHA256)"],
              ["Admin access", "Role-protected multi-tenant guards"],
              ["Password policy", "Min 12 chars + bcrypt hash"],
              ["Rate limiting", "Sliding window with auto-lockout"],
              ["Tenant boundary", "Strict Organization ID isolation"],
            ].map(([key, value]) => (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/30 px-4 py-3" key={key}>
                <span className="text-sm text-slate-400">{key}</span>
                <span className="rounded-lg bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workspace info */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-white">Workspace Overview</h2>
          <div className="mt-5 space-y-3">
            {[
              ["Organization", org.name],
              ["Tenant Slug", org.slug],
              ["Total Team Members", String(totalMembers)],
              ["Admins / Owners", String(adminCount)],
              ["Telecaller Agents", String(agentCount)],
              ["Google Sheets Status", sheetIntegration?.status || "NOT_CONNECTED"],
            ].map(([key, value]) => (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/30 px-4 py-3" key={key}>
                <span className="text-sm text-slate-400">{key}</span>
                <span className="text-sm font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white">Change Account Password</h2>
        <p className="mt-1 text-xs text-slate-400">
          Updating your password will automatically invalidate all other active sessions for account &quot;{user.username}&quot;.
        </p>
        <div className="mt-4 max-w-md">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
