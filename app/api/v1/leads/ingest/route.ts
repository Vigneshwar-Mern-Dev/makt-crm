import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { autoAssignCallLead } from "@/app/lib/lead-distribution";
import { autoQueueWhatsAppForCaller } from "@/app/lib/whatsapp-auto-queue";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return digits.length >= 7 ? `+${digits}` : "";
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Organization via API Key
    const authHeader = req.headers.get("authorization") || "";
    const xApiKey = req.headers.get("x-api-key") || "";
    let apiKey = xApiKey.trim();

    if (!apiKey && authHeader.toLowerCase().startsWith("bearer ")) {
      apiKey = authHeader.slice(7).trim();
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Provide via 'Authorization: Bearer <key>' or 'x-api-key' header." },
        { status: 401, headers: corsHeaders() }
      );
    }

    const org = await db.organization.findUnique({
      where: { apiKey },
      select: {
        id: true,
        name: true,
        leadDistributionEnabled: true,
        distributionMode: true,
        responseSlaMinutes: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your Organization API Key in Settings > Integrations." },
        { status: 401, headers: corsHeaders() }
      );
    }

    // 2. Parse Payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body provided." },
        { status: 400, headers: corsHeaders() }
      );
    }

    const rawPhone = String(body.phone || body.phoneNumber || body.mobile || "").trim();
    if (!rawPhone) {
      return NextResponse.json(
        { error: "Field 'phone' is required." },
        { status: 400, headers: corsHeaders() }
      );
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        { error: "Invalid phone number format." },
        { status: 400, headers: corsHeaders() }
      );
    }

    const displayName = String(body.name || body.displayName || body.fullName || `Lead ${phone.slice(-4)}`).trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const city = body.city ? String(body.city).trim() : null;
    const address = body.address ? String(body.address).trim() : null;
    const message = body.message || body.requirement || body.notes ? String(body.message || body.requirement || body.notes).trim() : null;
    const ownershipType = body.ownershipType ? String(body.ownershipType).trim() : null;

    // 3. Upsert or create the Lead within this Organization with name & duplicate protection
    const existing = await db.callLead.findFirst({
      where: {
        phone,
        organizationId: org.id,
        deletedAt: null,
      },
    });

    const isNew = !existing;
    const existingName = existing?.displayName?.trim() || "";
    const incomingName = displayName.trim();
    const isGenericName = !existingName || existingName.startsWith("Caller ") || existingName.startsWith("Lead ");
    const isNameDifferent = Boolean(
      !isGenericName &&
      incomingName &&
      existingName.toLowerCase() !== incomingName.toLowerCase()
    );

    // Preserve existing legitimate name to prevent greeting flip-flops on the same number.
    // Upgrade name only if existing name was placeholder/generic.
    const finalDisplayName = isGenericName && incomingName ? incomingName : existingName || incomingName;

    const lead = existing
      ? await db.callLead.update({
          where: { id: existing.id },
          data: {
            displayName: finalDisplayName,
            email: email || existing.email,
            city: city || existing.city,
            address: address || existing.address,
            message: message
              ? `${existing.message ? existing.message + "\n---\n" : ""}${isNameDifferent ? `[Alias/Alt Name: ${incomingName}] ` : ""}${message}`
              : isNameDifferent
                ? `${existing.message ? existing.message + "\n---\n" : ""}[Alias/Alt Name: ${incomingName}]`
                : existing.message,
            ownershipType: ownershipType || existing.ownershipType,
            lastContactedAt: new Date(),
          },
        })
      : await db.callLead.create({
          data: {
            organizationId: org.id,
            phone,
            displayName: incomingName,
            email,
            city,
            address,
            message,
            ownershipType,
            status: "NEW",
            lastContactedAt: new Date(),
          },
        });

    // 4. Log ingestion activity with duplicate detection
    if (isNew) {
      await db.callActivity.create({
        data: {
          leadId: lead.id,
          actionType: "NOTE_ADDED",
          description: `Lead ingested via Public API for organization "${org.name}"`,
          metadata: { phone, name: incomingName, source: "public_api" },
        },
      });
    } else {
      await db.callActivity.create({
        data: {
          leadId: lead.id,
          actionType: "NOTE_ADDED",
          description: isNameDifferent
            ? `[Duplicate Lead] Repeat entry for phone ${phone} with name "${incomingName}" (existing: "${existingName}"). WhatsApp duplicate send skipped.`
            : `[Duplicate Lead] Repeat submission for phone ${phone}. Details updated. WhatsApp duplicate send skipped.`,
          metadata: {
            phone,
            incomingName,
            existingName,
            isNameDifferent,
            source: "public_api",
          },
        },
      });
    }

    // 5. Trigger Auto-Assignment if lead is unassigned
    let assignedUser = null;
    if (isNew && !lead.assignedToId && org.leadDistributionEnabled) {
      try {
        const assignedResult = await autoAssignCallLead(lead.id, org.id);
        if (assignedResult && assignedResult.assignedTo) {
          assignedUser = assignedResult.assignedTo;
        }
      } catch (distErr) {
        console.error("Auto assignment failed on API lead ingest:", distErr);
      }
    }

    // 6. WhatsApp automation with strict duplicate suppression
    try {
      const existingWa = await db.whatsAppQueueItem.findFirst({
        where: {
          phone: lead.phone,
          deletedAt: null,
          isArchived: false,
          status: { in: ["QUEUED", "SENDING", "SENT", "OPENED", "FORM_STARTED", "FORM_SUBMITTED"] },
        },
        select: { id: true, status: true, displayName: true, sentAt: true },
      });

      const existingForm = await db.formSubmission.findFirst({
        where: { phone: lead.phone, status: "FORM_SUBMITTED", deletedAt: null },
        select: { id: true },
      });

      if (existingWa || existingForm) {
        console.log(
          `[dedup] Suppressed duplicate WhatsApp message for ${lead.phone}: already in state ${existingWa?.status || "FORM_SUBMITTED"} (name="${existingWa?.displayName || lead.displayName}").`,
        );
      } else {
        const routingSession = await db.callSession.findFirst({
          where: { leadId: lead.id, organizationId: org.id, deletedAt: null },
          orderBy: { firstRingAt: "desc" },
          select: { companyPhoneId: true },
        });
        await autoQueueWhatsAppForCaller(
          lead.phone,
          lead.displayName,
          "MISSED",
          lead.id,
          routingSession?.companyPhoneId,
          org.id
        );
      }
    } catch (waErr) {
      // WhatsApp sending is best-effort, does not block API response
      console.warn("WhatsApp auto-queue on ingest warning:", waErr);
    }

    // Re-fetch final lead status
    const finalLead = await db.callLead.findUnique({
      where: { id: lead.id },
      select: {
        id: true,
        displayName: true,
        phone: true,
        status: true,
        assignedToId: true,
        slaExpiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        isNew,
        lead: finalLead,
        assignedTo: assignedUser,
      },
      { status: isNew ? 201 : 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Error in lead ingestion API:", error);
    return NextResponse.json(
      { error: "Internal server error during lead ingestion." },
      { status: 500, headers: corsHeaders() }
    );
  }
}
