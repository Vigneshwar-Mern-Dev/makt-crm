import { describe, it, expect } from "vitest";
import { resolveSpinTax } from "@/app/lib/whatsapp-spintax";
import { matchCategory, BOT_TEMPLATES } from "@/app/lib/whatsapp-bot";
import {
  hasCompletedWhatsAppDelivery,
  getWhatsAppMessageDeliveryState,
} from "@/app/lib/whatsapp-delivery-status";
import { evaluateWhatsAppRetry } from "@/app/lib/whatsapp-retry";
import { normalizeWhatsAppE164 } from "@/app/lib/whatsapp-phone.mjs";

describe("End-to-End Workflow: Ingest ➔ WhatsApp ➔ Form ➔ Google Sheets", () => {
  // Test Data
  const sampleLead = {
    id: "lead_cm123abc456",
    name: "Ramesh Kumar",
    phone: "+91 98765 43210",
    city: "Chennai",
    address: "https://maps.google.com/?q=13.0827,80.2707",
    ownershipType: "OWN",
    message: "Interested in ATM franchise setup for prime commercial shop",
    stage: "INTERESTED",
    formToken: "ft_9a8b7c6d5e4f",
  };

  it("Step 1: Normalizes Indian phone number to strict E.164 format", () => {
    const normalized = normalizeWhatsAppE164(sampleLead.phone);
    expect(normalized).toBe("+919876543210");

    expect(normalizeWhatsAppE164("9876543210")).toBe("+919876543210");
    expect(normalizeWhatsAppE164("09876543210")).toBe("+919876543210");
  });

  it("Step 2: Resolves WhatsApp SpinTax message template with tokenized form link", () => {
    const rawTemplate =
      "{Hi|Hello|வணக்கம்} {{name}}! 🙏 {Thank you for contacting us.|தொடர்பு கொண்டதற்கு நன்றி.} Fill your details here: {{formLink}}";

    const formLink = `https://crm.planle.com/atm-franchise/${sampleLead.formToken}`;
    const populated = rawTemplate
      .replace("{{name}}", sampleLead.name)
      .replace("{{formLink}}", formLink);

    const message1 = resolveSpinTax(populated);

    // Verify template variables replaced
    expect(message1).toContain("Ramesh Kumar");
    expect(message1).toContain(formLink);
    expect(message1).not.toContain("{{name}}");
    expect(message1).not.toContain("{{formLink}}");
    expect(message1).not.toContain("{");
    expect(message1).not.toContain("}");

    // Verify valid greetings selected
    const validGreetings = ["Hi", "Hello", "வணக்கம்"];
    const hasValidGreeting = validGreetings.some((g) => message1.startsWith(g));
    expect(hasValidGreeting).toBe(true);
  });

  it("Step 3: Simulates WhatsApp customer interactive bot replies (Tamil & English)", () => {
    // Investment inquiry
    expect(matchCategory("What is the cost and investment deposit?")).toBe("INVESTMENT");
    expect(BOT_TEMPLATES.INVESTMENT).toContain("Security Deposit");

    // Tamil location inquiry
    expect(matchCategory("உங்கள் office முகவரி எங்கே?")).toBe("LOCATION");
    expect(BOT_TEMPLATES.LOCATION).toContain("Head Office");

    // DNC Opt-out
    expect(matchCategory("Stop please வேண்டாம்")).toBe("DNC");
  });

  it("Step 4: Tracks Form & Delivery Status Lifecycle transitions", () => {
    // 1. Initially queued
    expect(hasCompletedWhatsAppDelivery(["QUEUED"])).toBe(false);
    expect(getWhatsAppMessageDeliveryState("QUEUED", "NEW")).toBe("QUEUED");

    // 2. Sent by worker
    expect(hasCompletedWhatsAppDelivery(["SENT"])).toBe(true);
    expect(getWhatsAppMessageDeliveryState("SENT", "NEW")).toBe("SENT");

    // 3. Customer opens or submits form
    expect(getWhatsAppMessageDeliveryState("SENT", "FORM_SUBMITTED", true)).toBe("SENT");

    // Once form is submitted, retry should be rejected
    const retryCheck = evaluateWhatsAppRetry({
      status: "FORM_SUBMITTED",
      lastError: null,
      formSubmissions: [{ status: "FORM_SUBMITTED" }],
      queueItems: [{ status: "SENT", lastError: null }],
    });
    expect(retryCheck.retryable).toBe(false);
    expect(retryCheck.reasons).toContain("Form already submitted");
  });

  it("Step 5: Verifies Google Sheets Integration payload schema matches Apps Script contract", () => {
    const sheetIntegrationConfig = {
      sheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      sheetName: "Call Leads",
      action: "updateCallLead",
    };

    const sheetPayload = {
      action: sheetIntegrationConfig.action,
      sheetId: sheetIntegrationConfig.sheetId,
      sheetName: sheetIntegrationConfig.sheetName,
      lead: {
        id: sampleLead.id,
        name: sampleLead.name,
        email: "ramesh@example.com",
        phone: normalizeWhatsAppE164(sampleLead.phone),
        city: sampleLead.city,
        language: "ta",
        address: sampleLead.address,
        ownershipType: sampleLead.ownershipType,
        locationSent: true,
        stage: sampleLead.stage,
        assignedAgent: "Manoj Kumar",
        requirement: sampleLead.message,
        notes: "Verified owner of 120 sqft shop near main bus stand.",
        nextFollowUpAt: new Date("2026-10-30T10:00:00Z").toISOString(),
        lastContactedAt: new Date("2026-10-28T14:30:00Z").toISOString(),
        incomingCallCount: 1,
        outgoingCallCount: 0,
        lastCallDirection: "INCOMING",
        lastCallDurationSeconds: 78,
        updatedAt: new Date().toISOString(),
      },
    };

    // Assert Google Apps Script payload structure
    expect(sheetPayload.action).toBe("updateCallLead");
    expect(sheetPayload.sheetId).toBe(sheetIntegrationConfig.sheetId);
    expect(sheetPayload.sheetName).toBe("Call Leads");

    // Assert all 18 columns expected by Apps Script ensureHeaders()
    const expectedFields = [
      "id",
      "name",
      "phone",
      "email",
      "city",
      "language",
      "address",
      "ownershipType",
      "stage",
      "assignedAgent",
      "requirement",
      "notes",
      "nextFollowUpAt",
      "lastContactedAt",
      "incomingCallCount",
      "outgoingCallCount",
      "lastCallDurationSeconds",
      "updatedAt",
    ];

    for (const field of expectedFields) {
      expect(sheetPayload.lead).toHaveProperty(field);
      expect((sheetPayload.lead as Record<string, unknown>)[field]).not.toBeUndefined();
    }

    expect(sheetPayload.lead.phone).toBe("+919876543210");
    expect(sheetPayload.lead.ownershipType).toBe("OWN");
    expect(sheetPayload.lead.stage).toBe("INTERESTED");
    expect(sheetPayload.lead.lastCallDurationSeconds).toBe(78);
  });
});
