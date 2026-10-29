import "server-only";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { requireOrgRole, requireOrgUser } from "./org-session";

export type DistributionMode = "ROUND_ROBIN" | "LOAD_BALANCED";
export type AvailabilityStatus = "ONLINE" | "BUSY" | "OFFLINE";

/**
 * Finds the next eligible agent for lead assignment within an organization.
 */
export async function getNextEligibleAgent(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      leadDistributionEnabled: true,
      distributionMode: true,
      responseSlaMinutes: true,
      autoReassignOnBreach: true,
    },
  });

  if (!org || !org.leadDistributionEnabled) {
    return null;
  }

  // 1. Fetch online active members
  let eligibleMembers = await db.orgMember.findMany({
    where: {
      organizationId,
      availabilityStatus: "ONLINE",
      user: {
        isActive: true,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          department: true,
        },
      },
    },
  });

  // If no members are explicitly ONLINE, fall back to any active members who are not OFFLINE
  if (eligibleMembers.length === 0) {
    eligibleMembers = await db.orgMember.findMany({
      where: {
        organizationId,
        availabilityStatus: { not: "OFFLINE" },
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            department: true,
          },
        },
      },
    });
  }

  // If still empty, fall back to all active organization members
  if (eligibleMembers.length === 0) {
    eligibleMembers = await db.orgMember.findMany({
      where: {
        organizationId,
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            department: true,
          },
        },
      },
    });
  }

  if (eligibleMembers.length === 0) {
    return null;
  }

  // Distribution Strategy
  if (org.distributionMode === "LOAD_BALANCED") {
    // Pick the agent with the lowest number of NEW pending leads
    const memberLeadCounts = await Promise.all(
      eligibleMembers.map(async (m) => {
        const count = await db.callLead.count({
          where: {
            organizationId,
            assignedToId: m.userId,
            status: "NEW",
          },
        });
        return { member: m, count };
      }),
    );

    memberLeadCounts.sort((a, b) => a.count - b.count);
    const chosen = memberLeadCounts[0].member;

    return {
      memberId: chosen.id,
      user: chosen.user,
      slaMinutes: org.responseSlaMinutes,
      mode: org.distributionMode as DistributionMode,
    };
  }

  // Default: ROUND_ROBIN (least recently assigned)
  eligibleMembers.sort((a, b) => {
    if (!a.lastAssignedAt) return -1;
    if (!b.lastAssignedAt) return 1;
    return a.lastAssignedAt.getTime() - b.lastAssignedAt.getTime();
  });

  const chosen = eligibleMembers[0];

  return {
    memberId: chosen.id,
    user: chosen.user,
    slaMinutes: org.responseSlaMinutes,
    mode: org.distributionMode as DistributionMode,
  };
}

/**
 * Automatically assigns a CallLead using the organization's distribution rules.
 */
export async function autoAssignCallLead(callLeadId: string, orgId?: string) {
  const lead = await db.callLead.findUnique({
    where: { id: callLeadId },
    select: {
      id: true,
      phone: true,
      displayName: true,
      assignedToId: true,
      organizationId: true,
      status: true,
    },
  });

  if (!lead) return null;

  const targetOrgId = orgId || lead.organizationId;
  if (!targetOrgId) return null;

  // If already assigned to an agent, do not overwrite unless explicit
  if (lead.assignedToId) {
    return null;
  }

  const selection = await getNextEligibleAgent(targetOrgId);
  if (!selection) return null;

  const now = new Date();
  const slaExpiresAt = new Date(now.getTime() + selection.slaMinutes * 60 * 1000);

  const updatedLead = await db.$transaction(async (tx) => {
    const updated = await tx.callLead.update({
      where: { id: lead.id },
      data: {
        assignedToId: selection.user.id,
        assignedAt: now,
        slaExpiresAt,
        slaBreached: false,
      },
    });

    await tx.orgMember.update({
      where: { id: selection.memberId },
      data: {
        lastAssignedAt: now,
      },
    });

    await tx.callActivity.create({
      data: {
        leadId: lead.id,
        actionType: "ASSIGNMENT_CHANGE",
        userId: selection.user.id,
        description: `Auto-assigned via ${selection.mode} to ${selection.user.username}. Response SLA timer: ${selection.slaMinutes} minutes (due at ${slaExpiresAt.toLocaleTimeString()}).`,
      },
    });

    return updated;
  });

  return {
    leadId: updatedLead.id,
    assignedTo: selection.user,
    slaExpiresAt,
    slaMinutes: selection.slaMinutes,
  };
}

/**
 * Marks that a lead was contacted by an agent and stops the SLA timer.
 */
export async function recordLeadResponse(callLeadId: string, actorId?: string) {
  const lead = await db.callLead.findUnique({
    where: { id: callLeadId },
    select: {
      id: true,
      assignedAt: true,
      slaExpiresAt: true,
      firstResponseAt: true,
      slaBreached: true,
    },
  });

  if (!lead || lead.firstResponseAt) {
    return; // Already recorded
  }

  const now = new Date();
  const isBreached = Boolean(lead.slaExpiresAt && now > lead.slaExpiresAt);

  await db.callLead.update({
    where: { id: callLeadId },
    data: {
      firstResponseAt: now,
      lastContactedAt: now,
      ...(isBreached && !lead.slaBreached
        ? { slaBreached: true, slaBreachedAt: lead.slaExpiresAt || now }
        : {}),
    },
  });

  if (isBreached) {
    await db.callActivity.create({
      data: {
        leadId: callLeadId,
        actionType: "NOTE_ADDED",
        userId: actorId || null,
        description: `Response SLA Breached — first contact recorded at ${now.toLocaleTimeString()}, which exceeded the assigned SLA deadline.`,
      },
    });
  }
}

/**
 * Inspects all pending leads in the organization and reassigns any leads that breached their SLA.
 */
export async function checkAndReassignBreachedSlaLeads(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      autoReassignOnBreach: true,
      responseSlaMinutes: true,
      distributionMode: true,
    },
  });

  if (!org) return { breachedCount: 0, reassignedCount: 0 };

  const now = new Date();

  // Find leads where SLA deadline passed, status is still NEW, and not yet marked breached
  const breachedLeads = await db.callLead.findMany({
    where: {
      organizationId,
      status: "NEW",
      slaExpiresAt: { lt: now },
      firstResponseAt: null,
      slaBreached: false,
    },
    include: {
      assignedTo: {
        select: { id: true, username: true },
      },
    },
  });

  let reassignedCount = 0;

  for (const lead of breachedLeads) {
    await db.callLead.update({
      where: { id: lead.id },
      data: {
        slaBreached: true,
        slaBreachedAt: lead.slaExpiresAt || now,
      },
    });

    if (org.autoReassignOnBreach) {
      // Find a different eligible agent
      const nextAgent = await getNextEligibleAgent(organizationId);

      if (nextAgent && nextAgent.user.id !== lead.assignedToId) {
        const freshSla = new Date(now.getTime() + org.responseSlaMinutes * 60 * 1000);

        await db.$transaction(async (tx) => {
          await tx.callLead.update({
            where: { id: lead.id },
            data: {
              assignedToId: nextAgent.user.id,
              assignedAt: now,
              slaExpiresAt: freshSla,
              slaBreached: false,
            },
          });

          await tx.orgMember.update({
            where: { id: nextAgent.memberId },
            data: { lastAssignedAt: now },
          });

          await tx.callActivity.create({
            data: {
              leadId: lead.id,
              actionType: "ASSIGNMENT_CHANGE",
              userId: nextAgent.user.id,
              description: `Auto-reassigned due to SLA breach — previous assignee (${lead.assignedTo?.username || "Agent"}) did not respond within ${org.responseSlaMinutes}m SLA. Reassigned to ${nextAgent.user.username}.`,
            },
          });
        });

        reassignedCount++;
      }
    }
  }

  return {
    breachedCount: breachedLeads.length,
    reassignedCount,
  };
}

/**
 * Server action: Update the current user's availability status.
 */
export async function updateAgentAvailabilityAction(status: AvailabilityStatus) {
  const { user, org } = await requireOrgUser();

  const member = await db.orgMember.findFirst({
    where: {
      organizationId: org.id,
      userId: user.id,
    },
  });

  if (!member) {
    return { error: "Member record not found." };
  }

  await db.orgMember.update({
    where: { id: member.id },
    data: {
      availabilityStatus: status,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/user");
  return { success: true, status };
}

/**
 * Server action: Configure organization distribution settings (Owner/Admin only).
 */
export async function updateLeadDistributionConfigAction(data: {
  enabled: boolean;
  mode: DistributionMode;
  slaMinutes: number;
  autoReassign: boolean;
}) {
  const { org } = await requireOrgRole("ADMIN");

  const slaMinutes = Math.max(1, Math.min(1440, Number(data.slaMinutes) || 15));

  await db.organization.update({
    where: { id: org.id },
    data: {
      leadDistributionEnabled: Boolean(data.enabled),
      distributionMode: data.mode,
      responseSlaMinutes: slaMinutes,
      autoReassignOnBreach: Boolean(data.autoReassign),
    },
  });

  revalidatePath("/admin/settings/lead-distribution");
  revalidatePath("/admin/settings/organization");

  return { success: true };
}

/**
 * Fetches organization distribution metrics and SLA performance.
 */
export async function getLeadDistributionStats(organizationId: string) {
  const [org, members, totalLeads, activeNewLeads, breachedLeads, metSlaLeads] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: {
        leadDistributionEnabled: true,
        distributionMode: true,
        responseSlaMinutes: true,
        autoReassignOnBreach: true,
      },
    }),
    db.orgMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            department: true,
          },
        },
      },
      orderBy: { lastAssignedAt: "desc" },
    }),
    db.callLead.count({ where: { organizationId } }),
    db.callLead.count({ where: { organizationId, status: "NEW" } }),
    db.callLead.count({ where: { organizationId, slaBreached: true } }),
    db.callLead.count({
      where: {
        organizationId,
        firstResponseAt: { not: null },
        slaBreached: false,
      },
    }),
  ]);

  const totalSlaTracked = metSlaLeads + breachedLeads;
  const slaComplianceRate =
    totalSlaTracked > 0 ? Math.round((metSlaLeads / totalSlaTracked) * 100) : 100;

  const agentStats = await Promise.all(
    members.map(async (m) => {
      const [assignedCount, pendingCount, breachedCount] = await Promise.all([
        db.callLead.count({ where: { organizationId, assignedToId: m.userId } }),
        db.callLead.count({ where: { organizationId, assignedToId: m.userId, status: "NEW" } }),
        db.callLead.count({ where: { organizationId, assignedToId: m.userId, slaBreached: true } }),
      ]);

      return {
        memberId: m.id,
        userId: m.userId,
        username: m.user.username,
        email: m.user.email,
        department: m.user.department,
        role: m.role,
        availabilityStatus: m.availabilityStatus as AvailabilityStatus,
        lastAssignedAt: m.lastAssignedAt ? m.lastAssignedAt.toISOString() : null,
        assignedCount,
        pendingCount,
        breachedCount,
      };
    }),
  );

  return {
    config: org,
    metrics: {
      totalLeads,
      activeNewLeads,
      breachedLeads,
      metSlaLeads,
      slaComplianceRate,
    },
    agents: agentStats,
  };
}
