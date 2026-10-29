import { requireOrgRole } from "@/app/lib/org-session";
import { db } from "@/app/lib/db";
import { DeveloperSettingsClient } from "./developer-settings-client";
import { randomBytes } from "crypto";

export const metadata = {
  title: "Developer & API Settings | MAKT CRM",
};

export default async function DeveloperSettingsPage() {
  const { org } = await requireOrgRole("ADMIN");

  let organization = await db.organization.findUnique({
    where: { id: org.id },
    select: {
      id: true,
      name: true,
      slug: true,
      apiKey: true,
      createdAt: true,
    },
  });

  // Ensure organization has an API key if null
  if (organization && !organization.apiKey) {
    const generatedKey = "makt_live_" + randomBytes(16).toString("hex");
    organization = await db.organization.update({
      where: { id: org.id },
      data: { apiKey: generatedKey },
      select: {
        id: true,
        name: true,
        slug: true,
        apiKey: true,
        createdAt: true,
      },
    });
  }

  const recentIngestedLeads = await db.callLead.findMany({
    where: {
      organizationId: org.id,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      displayName: true,
      phone: true,
      status: true,
      assignedTo: { select: { username: true } },
      createdAt: true,
    },
  });

  return (
    <DeveloperSettingsClient
      organization={{
        id: organization?.id || org.id,
        name: organization?.name || org.name,
        slug: organization?.slug || org.slug,
        apiKey: organization?.apiKey || "",
        createdAt: organization?.createdAt || new Date(),
      }}
      recentLeads={recentIngestedLeads}
    />
  );
}
