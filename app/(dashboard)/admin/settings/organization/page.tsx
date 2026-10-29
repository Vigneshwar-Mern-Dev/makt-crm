import Link from "next/link";
import { db } from "@/app/lib/db";
import { requireOrgUser, hasMinRole } from "@/app/lib/org-session";
import { OrganizationSettingsForm } from "./organization-settings-form";

export default async function OrganizationSettingsPage() {
  const { org: currentOrg, orgRole } = await requireOrgUser();

  const organization = await db.organization.findUnique({
    where: { id: currentOrg.id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, email: true },
          },
        },
      },
      invitations: {
        where: { status: "PENDING" },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const memberCounts = {
    total: organization.members.length,
    owners: organization.members.filter((m) => m.role === "OWNER").length,
    admins: organization.members.filter((m) => m.role === "ADMIN").length,
    members: organization.members.filter((m) => m.role === "MEMBER").length,
    pendingInvites: organization.invitations.length,
  };

  const canEdit = hasMinRole(orgRole, "ADMIN");

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Multi-Tenant SaaS
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
              Role: {orgRole}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
            {organization.name}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your organization profile, URL identifier, and tenant isolation configuration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings/members"
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 shadow-lg shadow-cyan-500/10 flex items-center gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            Manage Team & Invites →
          </Link>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Members", count: memberCounts.total, desc: "Team accounts in org", glow: "border-cyan-500/20 bg-cyan-950/10 text-cyan-400" },
          { label: "Organization Admins", count: memberCounts.admins + memberCounts.owners, desc: `${memberCounts.owners} Owner, ${memberCounts.admins} Admin`, glow: "border-blue-500/20 bg-blue-950/10 text-blue-400" },
          { label: "Team Agents", count: memberCounts.members, desc: "Member portal access", glow: "border-teal-500/20 bg-teal-950/10 text-teal-400" },
          { label: "Pending Invites", count: memberCounts.pendingInvites, desc: "Unclaimed invitations", glow: "border-amber-500/20 bg-amber-950/10 text-amber-400" },
        ].map((item, idx) => (
          <div key={idx} className={`rounded-xl border p-5 backdrop-blur-md ${item.glow}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-white">{item.count}</p>
            <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Organization Profile Settings Form */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">Organization Profile</h2>
          <p className="text-xs text-slate-400">Configure your organization details and URL identifier.</p>
        </div>

        <OrganizationSettingsForm
          initialName={organization.name}
          initialSlug={organization.slug}
          initialLogo={organization.logo}
          canEdit={canEdit}
        />
      </section>

      {/* Tenant Metadata & Security Details */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md space-y-4">
          <h2 className="text-lg font-bold text-white">Tenant Isolation</h2>
          <div className="space-y-3">
            {[
              ["Tenant ID", organization.id],
              ["Created Date", new Date(organization.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
              ["URL Identifier", `crm/org/${organization.slug}`],
              ["Data Isolation Mode", "Foreign Key Tenant-Scoping (Strict)"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-4 py-3">
                <span className="text-xs text-slate-400">{k}</span>
                <span className="font-mono text-xs text-cyan-300 truncate max-w-[240px]">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md space-y-4">
          <h2 className="text-lg font-bold text-white">Role Hierarchy</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3.5 text-xs text-slate-300">
              <span className="font-bold text-cyan-300">OWNER:</span> Full organization access, member invitations, manual member creation, role management, and tenant settings.
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-3.5 text-xs text-slate-300">
              <span className="font-bold text-blue-300">ADMIN:</span> Organization-wide CRM management, invite team members, manual member account setup, and CRM operations.
            </div>
            <div className="rounded-lg border border-teal-500/20 bg-teal-950/20 p-3.5 text-xs text-slate-300">
              <span className="font-bold text-teal-300">MEMBER:</span> Dedicated agent portal (`/user`) with lead claiming, call sessions, WhatsApp replies, and tasks.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
