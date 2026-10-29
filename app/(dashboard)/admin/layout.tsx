import type { ReactNode } from "react";
import { requireOrgUser } from "@/app/lib/org-session";
import { db } from "@/app/lib/db";
import { AdminShell } from "./components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { user, org, orgRole } = await requireOrgUser();

  // Fetch the current user's availability status for the header pill
  const membership = await db.orgMember.findFirst({
    where: { organizationId: org.id, userId: user.id },
    select: { availabilityStatus: true },
  });

  return (
    <AdminShell
      user={user}
      org={org}
      orgRole={orgRole}
      availabilityStatus={(membership?.availabilityStatus as "ONLINE" | "BUSY" | "OFFLINE") || "ONLINE"}
    >
      {children}
    </AdminShell>
  );
}
