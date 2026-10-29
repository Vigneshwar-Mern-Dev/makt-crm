import Link from "next/link";
import { db } from "@/app/lib/db";
import { requireOrgRole } from "@/app/lib/org-session";
import { MembersClientManager } from "./members-client-manager";

export default async function OrgMembersPage() {
  const { org, orgRole, user } = await requireOrgRole("ADMIN");

  const [members, invitations] = await Promise.all([
    db.orgMember.findMany({
      where: { organizationId: org.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            department: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    db.orgInvitation.findMany({
      where: {
        organizationId: org.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_CRM_URL || "http://localhost:3000";

  return (
    <div className="space-y-6 pb-8">
      {/* Page Title Banner */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/settings/organization"
              className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300 hover:underline"
            >
              {org.name}
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Team Members
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
            Members &amp; Invitations
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Invite colleagues via link or manually provision accounts directly into {org.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/settings/organization"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Org Settings
          </Link>
        </div>
      </section>

      {/* Main Interactive Manager */}
      <MembersClientManager
        members={members.map((m) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: m.user,
        }))}
        invitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          status: i.status,
          expiresAt: i.expiresAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
        }))}
        currentUserId={user.id}
        currentUserRole={orgRole}
        orgName={org.name}
        baseUrl={baseUrl}
      />
    </div>
  );
}
