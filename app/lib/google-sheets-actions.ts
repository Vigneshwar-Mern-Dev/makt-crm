"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { requireOrgRole } from "@/app/lib/org-session";
import { LeadSource, SheetConnectionStatus } from "@/app/lib/prisma-enums";
import { syncCallLeadToSheetBackground } from "@/app/lib/call-lead-actions";

/**
 * Extracts a Google Spreadsheet ID if the user provided a full Google Docs URL.
 * e.g., https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
 */
function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Fetches the Google Sheets LeadIntegration for the caller's organization.
 */
export async function getGoogleSheetsIntegrationAction() {
  try {
    const { org } = await requireOrgRole("ADMIN");

    const integration = await db.leadIntegration.findFirst({
      where: {
        organizationId: org.id,
        source: LeadSource.CALLS,
      },
    });

    const orgRecord = await db.organization.findUnique({
      where: { id: org.id },
      select: { apiKey: true },
    });

    const crmBaseUrl =
      process.env.CRM_PUBLIC_URL?.trim() ||
      process.env.NEXT_PUBLIC_CRM_URL?.trim() ||
      "https://crm.planle.com";

    return {
      success: true,
      org: {
        id: org.id,
        name: org.name,
        apiKey: orgRecord?.apiKey || null,
      },
      crmBaseUrl,
      integration: integration
        ? {
            id: integration.id,
            appScriptUrl: integration.appScriptUrl,
            spreadsheetId: integration.spreadsheetId,
            sheetName: integration.sheetName,
            secretToken: integration.secretToken,
            status: integration.status as "NOT_CONNECTED" | "CONNECTED" | "ERROR",
            lastTestedAt: integration.lastTestedAt ? integration.lastTestedAt.toISOString() : null,
            lastSyncedAt: integration.lastSyncedAt ? integration.lastSyncedAt.toISOString() : null,
            importedCount: integration.importedCount,
            failedCount: integration.failedCount,
            lastError: integration.lastError,
          }
        : null,
    };
  } catch (error) {
    console.error("Failed to load Google Sheets integration:", error);
    return { error: "Failed to load Google Sheets settings." };
  }
}

/**
 * Saves or updates the Google Sheets LeadIntegration configuration.
 */
export async function saveGoogleSheetsIntegrationAction(formData: FormData) {
  try {
    const { org } = await requireOrgRole("ADMIN");

    const rawAppScriptUrl = String(formData.get("appScriptUrl") || "").trim();
    const rawSpreadsheetId = String(formData.get("spreadsheetId") || "").trim();
    const rawSheetName = String(formData.get("sheetName") || "").trim() || "Call Leads";
    const rawSecretToken = String(formData.get("secretToken") || "").trim();

    if (!rawAppScriptUrl) {
      return { error: "Google Apps Script Web App URL is required." };
    }

    try {
      new URL(rawAppScriptUrl);
    } catch {
      return { error: "Invalid Google Apps Script URL format." };
    }

    const spreadsheetId = extractSpreadsheetId(rawSpreadsheetId);
    if (!spreadsheetId) {
      return { error: "Spreadsheet ID or Google Sheet URL is required." };
    }

    const integration = await db.leadIntegration.upsert({
      where: {
        organizationId_source: {
          organizationId: org.id,
          source: LeadSource.CALLS,
        },
      },
      create: {
        organizationId: org.id,
        source: LeadSource.CALLS,
        appScriptUrl: rawAppScriptUrl,
        spreadsheetId,
        sheetName: rawSheetName,
        secretToken: rawSecretToken || null,
        status: SheetConnectionStatus.NOT_CONNECTED,
      },
      update: {
        appScriptUrl: rawAppScriptUrl,
        spreadsheetId,
        sheetName: rawSheetName,
        secretToken: rawSecretToken || null,
      },
    });

    revalidatePath("/admin/settings/google-sheets");
    return { success: true, integrationId: integration.id };
  } catch (error) {
    console.error("Error saving Google Sheets integration:", error);
    return { error: "Failed to save Google Sheets settings." };
  }
}

/**
 * Pings the Google Apps Script Web App to verify connectivity.
 */
export async function testGoogleSheetsConnectionAction() {
  try {
    const { org } = await requireOrgRole("ADMIN");

    const integration = await db.leadIntegration.findFirst({
      where: {
        organizationId: org.id,
        source: LeadSource.CALLS,
      },
    });

    if (!integration?.appScriptUrl || !integration.spreadsheetId || !integration.sheetName) {
      return {
        error: "Google Sheets integration is not configured yet. Please fill in the URL and Spreadsheet ID first.",
      };
    }

    const url = new URL(integration.appScriptUrl);
    const key = integration.secretToken?.replace(/^['"]|['"]$/g, "").trim();
    if (key) {
      url.searchParams.set("key", key);
    }

    const now = new Date();
    try {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ping",
          sheetId: integration.spreadsheetId,
          sheetName: integration.sheetName,
        }),
      });

      if (!response.ok) {
        const errorMsg = `Google Apps Script returned HTTP status ${response.status}. Ensure your deployment is set to 'Execute as: Me' and 'Who has access: Anyone'.`;
        await db.leadIntegration.update({
          where: { id: integration.id },
          data: {
            status: SheetConnectionStatus.ERROR,
            lastTestedAt: now,
            lastError: errorMsg,
          },
        });
        revalidatePath("/admin/settings/google-sheets");
        return { error: errorMsg };
      }

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        sheetTitle?: string;
      };

      if (payload.ok === false) {
        const errorMsg = `Google Apps Script reported an error: ${payload.error || "Unknown script error"}`;
        await db.leadIntegration.update({
          where: { id: integration.id },
          data: {
            status: SheetConnectionStatus.ERROR,
            lastTestedAt: now,
            lastError: errorMsg,
          },
        });
        revalidatePath("/admin/settings/google-sheets");
        return { error: errorMsg };
      }

      await db.leadIntegration.update({
        where: { id: integration.id },
        data: {
          status: SheetConnectionStatus.CONNECTED,
          lastTestedAt: now,
          lastError: null,
        },
      });

      revalidatePath("/admin/settings/google-sheets");
      return {
        success: true,
        message: payload.sheetTitle
          ? `Connected successfully to sheet "${payload.sheetTitle}"!`
          : "Connected successfully to Google Sheet!",
      };
    } catch (fetchErr: unknown) {
      const errorMsg = `Failed to connect to Google Apps Script: ${fetchErr instanceof Error ? fetchErr.message : "Network error"}`;
      await db.leadIntegration.update({
        where: { id: integration.id },
        data: {
          status: SheetConnectionStatus.ERROR,
          lastTestedAt: now,
          lastError: errorMsg,
        },
      });
      revalidatePath("/admin/settings/google-sheets");
      return { error: errorMsg };
    }
  } catch (error) {
    console.error("Test connection exception:", error);
    return { error: "An unexpected error occurred during testing." };
  }
}

/**
 * Bulk syncs all active call leads for this organization to Google Sheets.
 */
export async function bulkSyncCallLeadsToSheetAction() {
  try {
    const { org } = await requireOrgRole("ADMIN");

    const leads = await db.callLead.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        isArchived: false,
      },
      select: { id: true },
      take: 50,
    });

    if (leads.length === 0) {
      return { message: "No active call leads to sync." };
    }

    let synced = 0;
    for (const lead of leads) {
      await syncCallLeadToSheetBackground(lead.id);
      synced++;
    }

    await db.leadIntegration.updateMany({
      where: { organizationId: org.id, source: LeadSource.CALLS },
      data: {
        lastSyncedAt: new Date(),
        importedCount: { increment: synced },
      },
    });

    revalidatePath("/admin/settings/google-sheets");
    revalidatePath("/admin/calls/leads");
    return { success: true, count: synced };
  } catch (error) {
    console.error("Bulk sync error:", error);
    return { error: "Bulk sync failed." };
  }
}
