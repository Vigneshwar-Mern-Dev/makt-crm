"use client";

import { useState, useTransition } from "react";
import {
  saveGoogleSheetsIntegrationAction,
  testGoogleSheetsConnectionAction,
  bulkSyncCallLeadsToSheetAction,
} from "@/app/lib/google-sheets-actions";

type GoogleSheetsClientProps = {
  initialIntegration: {
    id: string;
    appScriptUrl: string | null;
    spreadsheetId: string | null;
    sheetName: string;
    secretToken: string | null;
    status: "NOT_CONNECTED" | "CONNECTED" | "ERROR";
    lastTestedAt: string | null;
    lastSyncedAt: string | null;
    importedCount: number;
    failedCount: number;
    lastError: string | null;
  } | null;
  orgName: string;
  orgApiKey: string | null;
  crmBaseUrl: string;
};

export function GoogleSheetsClient({
  initialIntegration,
  orgName,
  orgApiKey,
  crmBaseUrl,
}: GoogleSheetsClientProps) {
  const [activeTab, setActiveTab] = useState<"config" | "code" | "guide">("config");

  // Form state
  const [appScriptUrl, setAppScriptUrl] = useState(initialIntegration?.appScriptUrl || "");
  const [spreadsheetId, setSpreadsheetId] = useState(initialIntegration?.spreadsheetId || "");
  const [sheetName, setSheetName] = useState(initialIntegration?.sheetName || "Call Leads");
  const [secretToken, setSecretToken] = useState(initialIntegration?.secretToken || "");

  // Status and feedback
  const [status, setStatus] = useState<"NOT_CONNECTED" | "CONNECTED" | "ERROR">(
    initialIntegration?.status || "NOT_CONNECTED",
  );
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(
    initialIntegration?.lastTestedAt || null,
  );
  const [lastError, setLastError] = useState<string | null>(initialIntegration?.lastError || null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Auto-extract spreadsheet ID if full URL pasted
  function handleSpreadsheetIdChange(val: string) {
    const match = val.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      setSpreadsheetId(match[1]);
    } else {
      setSpreadsheetId(val);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("appScriptUrl", appScriptUrl);
    formData.append("spreadsheetId", spreadsheetId);
    formData.append("sheetName", sheetName);
    formData.append("secretToken", secretToken);

    startTransition(async () => {
      const res = await saveGoogleSheetsIntegrationAction(formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setMessage("Google Sheets settings saved successfully. You can now test the connection.");
      }
    });
  }

  function handleTestConnection() {
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      const res = await testGoogleSheetsConnectionAction();
      if (res.error) {
        setStatus("ERROR");
        setLastError(res.error);
        setErrorMessage(res.error);
      } else {
        setStatus("CONNECTED");
        setLastError(null);
        setLastTestedAt(new Date().toISOString());
        setMessage(res.message || "Connected successfully to Google Sheet!");
      }
    });
  }

  function handleBulkSync() {
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      const res = await bulkSyncCallLeadsToSheetAction();
      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.count !== undefined) {
        setMessage(`Successfully synced ${res.count} call leads to Google Sheet.`);
      } else {
        setMessage(res.message || "Sync finished.");
      }
    });
  }

  // Pre-configured Google Apps Script code for this tenant
  const appsScriptCode = `/**
 * Google Apps Script for MAKT CRM Integration
 * Organization: ${orgName}
 * Generated for CRM Base URL: ${crmBaseUrl}
 */

const SECRET_KEY = "${secretToken || "YOUR_SECRET_KEY_HERE"}";
const CRM_API_URL = "${crmBaseUrl}/api/v1/leads/ingest";
const CRM_API_KEY = "${orgApiKey || "YOUR_CRM_API_KEY_HERE"}";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Missing payload" }, 400);
    }

    const data = JSON.parse(e.postData.contents);

    // Optional Key check
    if (SECRET_KEY && SECRET_KEY !== "YOUR_SECRET_KEY_HERE") {
      const keyParam = (e.parameter && e.parameter.key) || data.key;
      if (keyParam !== SECRET_KEY) {
        return jsonResponse({ ok: false, error: "Unauthorized: Invalid secret key" }, 401);
      }
    }

    const ss = data.sheetId 
      ? SpreadsheetApp.openById(data.sheetId) 
      : SpreadsheetApp.getActiveSpreadsheet();
      
    const sheet = data.sheetName 
      ? (ss.getSheetByName(data.sheetName) || ss.insertSheet(data.sheetName))
      : ss.getActiveSheet();

    // 1. Ping / Test Connection
    if (data.action === "ping") {
      return jsonResponse({ 
        ok: true, 
        message: "Pong! Connected to Google Sheet successfully.",
        sheetTitle: sheet.getName(),
        spreadsheetName: ss.getName()
      });
    }

    // 2. Update or Insert Call Lead
    if (data.action === "updateCallLead") {
      const lead = data.lead;
      if (!lead || !lead.id) {
        return jsonResponse({ ok: false, error: "Missing lead payload" }, 400);
      }

      ensureHeaders(sheet);
      const updated = updateOrInsertLead(sheet, lead);
      return jsonResponse({ ok: true, updated: updated });
    }

    return jsonResponse({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    const headers = [
      "Lead ID", "Name", "Phone", "Email", "City", "Language",
      "Address", "Property Type", "Stage", "Assigned Agent",
      "Requirement / Message", "Notes", "Next Follow Up", "Last Contacted At",
      "Incoming Calls", "Outgoing Calls", "Last Call Duration (s)", "Updated At"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
  }
}

function updateOrInsertLead(sheet, lead) {
  const data = sheet.getDataRange().getValues();
  let targetRow = -1;

  // Search existing lead by ID (col 1) or Phone (col 3)
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0]).trim();
    const rowPhone = String(data[i][2]).replace(/\\D/g, "");
    const leadPhone = String(lead.phone || "").replace(/\\D/g, "");

    if (rowId === lead.id || (leadPhone && rowPhone.endsWith(leadPhone.slice(-10)))) {
      targetRow = i + 1; // 1-indexed
      break;
    }
  }

  const rowValues = [
    lead.id,
    lead.name || "",
    lead.phone || "",
    lead.email || "",
    lead.city || "",
    lead.language || "",
    lead.address || "",
    lead.ownershipType || "",
    lead.stage || "",
    lead.assignedAgent || "",
    lead.requirement || "",
    lead.notes || "",
    lead.nextFollowUpAt || "",
    lead.lastContactedAt || "",
    lead.incomingCallCount || 0,
    lead.outgoingCallCount || 0,
    lead.lastCallDurationSeconds || 0,
    lead.updatedAt || new Date().toISOString()
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    return true;
  } else {
    sheet.appendRow(rowValues);
    return true;
  }
}

function jsonResponse(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Optional Trigger: Push leads from Sheet into CRM
 * Run on new row additions in your Google Sheet.
 */
function sendLeadToCRM(name, phone, email, city, notes) {
  if (!CRM_API_KEY || CRM_API_KEY === "YOUR_CRM_API_KEY_HERE") {
    throw new Error("Please configure CRM_API_KEY");
  }
  const payload = {
    name: name,
    phone: phone,
    email: email,
    city: city,
    notes: notes
  };
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + CRM_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const res = UrlFetchApp.fetch(CRM_API_URL, options);
  Logger.log(res.getContentText());
}
`;

  function copyAppsScript() {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.05] via-white/[0.01] to-transparent p-6 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-white">Google Sheets Two-Way Sync</span>
              {status === "CONNECTED" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-0.5 text-xs font-bold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              )}
              {status === "ERROR" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/15 px-3 py-0.5 text-xs font-bold text-rose-300">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Connection Error
                </span>
              )}
              {status === "NOT_CONNECTED" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/30 bg-slate-500/15 px-3 py-0.5 text-xs font-bold text-slate-300">
                  Not Connected
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Synchronize qualified call leads directly to your Google Spreadsheet with 1-click updates and automated webhooks.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestConnection}
              disabled={isPending || !appScriptUrl}
              className="h-9 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
            >
              {isPending ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={handleBulkSync}
              disabled={isPending || status !== "CONNECTED"}
              className="h-9 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
            >
              {isPending ? "Syncing..." : "Sync All Leads"}
            </button>
          </div>
        </div>

        {/* Sync telemetry pills */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sheet Tab</span>
            <p className="mt-1 text-sm font-bold text-white truncate">{sheetName || "Call Leads"}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Synced</span>
            <p className="mt-1 text-sm font-bold text-emerald-300">{initialIntegration?.importedCount || 0}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Tested</span>
            <p className="mt-1 text-xs text-slate-300 truncate">
              {lastTestedAt ? new Date(lastTestedAt).toLocaleTimeString("en-IN") : "Never"}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Synced</span>
            <p className="mt-1 text-xs text-slate-300 truncate">
              {initialIntegration?.lastSyncedAt
                ? new Date(initialIntegration.lastSyncedAt).toLocaleTimeString("en-IN")
                : "Never"}
            </p>
          </div>
        </div>
      </section>

      {/* Messages */}
      {message && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-200">
          ✓ {message}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-medium text-rose-200">
          ⚠ {errorMessage}
        </div>
      )}
      {lastError && !errorMessage && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          Last Error: {lastError}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 gap-6">
        <button
          onClick={() => setActiveTab("config")}
          className={`pb-3 text-sm font-semibold transition ${
            activeTab === "config"
              ? "border-b-2 border-cyan-400 text-cyan-300"
              : "text-slate-400 hover:text-white"
          }`}
        >
          1. Sheet Configuration
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={`pb-3 text-sm font-semibold transition ${
            activeTab === "code"
              ? "border-b-2 border-cyan-400 text-cyan-300"
              : "text-slate-400 hover:text-white"
          }`}
        >
          2. Google Apps Script Code
        </button>
        <button
          onClick={() => setActiveTab("guide")}
          className={`pb-3 text-sm font-semibold transition ${
            activeTab === "guide"
              ? "border-b-2 border-cyan-400 text-cyan-300"
              : "text-slate-400 hover:text-white"
          }`}
        >
          3. Step-by-Step Setup Guide
        </button>
      </div>

      {/* Tab 1: Configuration Form */}
      {activeTab === "config" && (
        <form onSubmit={handleSave} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Google Apps Script Web App URL <span className="text-rose-400">*</span>
            </label>
            <input
              type="url"
              required
              value={appScriptUrl}
              onChange={(e) => setAppScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              The Web App deployment URL generated from Extensions ➔ Apps Script in your Google Sheet.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Google Spreadsheet ID or URL <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={spreadsheetId}
                onChange={(e) => handleSpreadsheetIdChange(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Paste your full Google Sheets link or just the ID — we extract it automatically.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Sheet Tab Name
              </label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Call Leads"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                The name of the worksheet tab at the bottom (defaults to &quot;Call Leads&quot;).
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Secret Token / Key (Optional)
            </label>
            <input
              type="text"
              value={secretToken}
              onChange={(e) => setSecretToken(e.target.value)}
              placeholder="e.g. secret_sync_token_123"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Optional shared secret key between CRM and Apps Script for extra request verification.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-xs text-slate-400">
              Changes apply immediately to telecaller &quot;Save Lead, Workflow & Sheet&quot; operations.
            </span>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-cyan-400 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Apps Script Code */}
      {activeTab === "code" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Pre-Configured Google Apps Script</h3>
              <p className="text-xs text-slate-400 mt-1">
                This code is already customized with your organization name and API key.
              </p>
            </div>
            <button
              onClick={copyAppsScript}
              className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20"
            >
              {copiedCode ? "✓ Copied to Clipboard!" : "Copy Apps Script Code"}
            </button>
          </div>

          <div className="relative rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-[500px]">
            <pre>{appsScriptCode}</pre>
          </div>
        </div>
      )}

      {/* Tab 3: Setup Guide */}
      {activeTab === "guide" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
          <h3 className="text-lg font-bold text-white">How to deploy Google Sheets sync in 3 minutes</h3>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 border border-cyan-400/30">
                1
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Open your Google Spreadsheet</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Create a new Google Sheet or open your existing leads spreadsheet. In the top menu, click{" "}
                  <strong className="text-white">Extensions ➔ Apps Script</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 border border-cyan-400/30">
                2
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Paste the Pre-Configured Script</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Go to the <strong>Google Apps Script Code</strong> tab above, click <strong>Copy Code</strong>, and replace the contents of <code>Code.gs</code> in the Google editor.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 border border-cyan-400/30">
                3
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Deploy as Web App</h4>
                <p className="text-xs text-slate-400 mt-1">
                  In Google Apps Script, click <strong className="text-white">Deploy ➔ New deployment</strong>.
                </p>
                <ul className="mt-2 list-disc list-inside text-xs text-slate-400 space-y-1">
                  <li>Click gear icon ⚙️ ➔ Select <strong>Web app</strong></li>
                  <li>Execute as: <strong className="text-white">Me (your email)</strong></li>
                  <li>Who has access: <strong className="text-emerald-400">Anyone</strong> (critical for CRM webhooks)</li>
                  <li>Click <strong>Deploy</strong> and copy the generated <strong>Web app URL</strong></li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 border border-cyan-400/30">
                4
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Save &amp; Test Connection</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Paste the Web App URL into the <strong>Sheet Configuration</strong> tab and click <strong>Test Connection</strong>. You should see a green &quot;Connected&quot; indicator immediately!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

