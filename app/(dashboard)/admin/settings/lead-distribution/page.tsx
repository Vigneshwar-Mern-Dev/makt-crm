import { requireOrgRole } from "@/app/lib/org-session";
import { getLeadDistributionStats } from "@/app/lib/lead-distribution";
import { LeadDistributionClient } from "./lead-distribution-client";

export default async function LeadDistributionPage() {
  const { org } = await requireOrgRole("ADMIN");
  const stats = await getLeadDistributionStats(org.id);

  return <LeadDistributionClient stats={stats} />;
}
