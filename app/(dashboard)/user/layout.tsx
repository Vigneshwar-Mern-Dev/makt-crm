import type { ReactNode } from "react";
import { requireRole } from "@/app/lib/session";
import { getUserWorkloadSummary } from "@/app/lib/user-workload";
import { UserShell } from "./components/user-shell";

export const dynamic = "force-dynamic";

export default async function UserLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireRole("USER");
  const { data: workload } = await getUserWorkloadSummary(user.id);

  return (
    <UserShell
      user={user}
      workload={{
        callFollowups: workload.callFollowups,
        callOpenLeads: workload.callOpenLeads,
        openTasks: workload.openTasks,
        overdueTasks: workload.overdueTasks,
      }}
    >
      {children}
    </UserShell>
  );
}
