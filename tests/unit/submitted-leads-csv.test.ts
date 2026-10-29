import { describe, it, expect } from "vitest";
import {
  buildSubmittedLeadsCsv,
  type SubmittedLeadExportRow,
} from "@/app/lib/submitted-leads-csv";

describe("Submitted Leads CSV Generator", () => {
  const sampleRow: SubmittedLeadExportRow = {
    submittedAt: "2026-10-15 10:00:00",
    submissionId: "sub-12345",
    name: "Murugan Selvam",
    phone: "+919876543210",
    city: "Chennai",
    propertyType: "Commercial Ground Floor",
    mapsLocation: "https://maps.google.com/?q=13.0827,80.2707",
    callLeadId: "lead-abc",
    callLeadStatus: "INTERESTED",
    assignedAgent: "Vigneshwar",
    email: "murugan@example.com",
    language: "Tamil",
    provider: "Hitachi",
    requirement: "ATM Installation",
    notes: "Has 80 sqft shop near main market",
    firstCompanyPhone: "919585888319",
    lastCompanyPhone: "919585888319",
    lastContactedAt: "2026-10-15 09:30:00",
    nextFollowUpAt: "2026-10-16 10:00:00",
    locationSent: "Yes",
    whatsappLeadId: "wa-xyz",
    whatsappAccount: "Website Sales",
    messageStatus: "REPLIED",
    messageSentAt: "2026-10-15 08:00:00",
    sheetSyncedAt: "2026-10-15 10:05:00",
    sheetSyncWarning: "None",
  };

  it("generates CSV header matching required columns", () => {
    const csv = buildSubmittedLeadsCsv([sampleRow]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("Customer Name");
    expect(lines[0]).toContain("Submission ID");
    expect(lines[0]).toContain("Sheet Synced At");
  });

  it("escapes fields containing commas and quotes properly", () => {
    const rowWithCommas: SubmittedLeadExportRow = {
      ...sampleRow,
      notes: 'Contains, commas, and "quoted" strings',
    };

    const csv = buildSubmittedLeadsCsv([rowWithCommas]);
    expect(csv).toContain('""quoted""');
  });

  it("neutralizes Excel formula injection vulnerabilities", () => {
    const maliciousRow: SubmittedLeadExportRow = {
      ...sampleRow,
      name: "=cmd|' /C calc'!A0",
      city: "+1+1",
      notes: "@SUM(1,2)",
    };

    const csv = buildSubmittedLeadsCsv([maliciousRow]);
    // Vulnerable formula triggers =, +, -, @ must be prefixed with single quote '
    expect(csv).toContain("\"'=cmd");
    expect(csv).toContain("\"'+1+1\"");
    expect(csv).toContain("\"'@SUM");
  });
});
