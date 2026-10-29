"use client";

import { useState, useTransition } from "react";
import { regenerateOrgApiKeyAction } from "@/app/lib/org-actions";

type DeveloperSettingsClientProps = {
  organization: {
    id: string;
    name: string;
    slug: string;
    apiKey: string;
    createdAt: Date;
  };
  recentLeads: Array<{
    id: string;
    displayName: string;
    phone: string;
    status: string;
    assignedTo?: { username: string } | null;
    createdAt: Date;
  }>;
};

export function DeveloperSettingsClient({
  organization,
  recentLeads,
}: DeveloperSettingsClientProps) {
  const [apiKey, setApiKey] = useState(organization.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJs, setCopiedJs] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"curl" | "javascript" | "python" | "zapier">("curl");
  const [isPending, startTransition] = useTransition();

  // Test Simulator State
  const [testName, setTestName] = useState("Alex Johnson");
  const [testPhone, setTestPhone] = useState("+919876543210");
  const [testEmail, setTestEmail] = useState("alex@example.com");
  const [testCity, setTestCity] = useState("Mumbai");
  const [testNotes, setTestNotes] = useState("Inquiry from website contact form");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{
    status: number;
    data: any;
    error?: string;
  } | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://crm.makt.com";
  const endpointUrl = `${baseUrl}/api/v1/leads/ingest`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleRegenerateKey = () => {
    if (!window.confirm("⚠️ Are you sure you want to regenerate your API Key? Any existing webhook or website form using the old key will stop working immediately.")) {
      return;
    }

    startTransition(async () => {
      const result = await regenerateOrgApiKeyAction();
      if (result.success && result.apiKey) {
        setApiKey(result.apiKey);
      }
    });
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimResult(null);

    try {
      const res = await fetch("/api/v1/leads/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: testName,
          phone: testPhone,
          email: testEmail,
          city: testCity,
          message: testNotes,
        }),
      });

      const data = await res.json().catch(() => ({ error: "Non-JSON response" }));
      setSimResult({
        status: res.status,
        data,
      });
    } catch (err) {
      setSimResult({
        status: 500,
        data: null,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSimulating(false);
    }
  };

  const curlSnippet = `curl -X POST "${endpointUrl}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Sarah Miller",
    "phone": "+919876543210",
    "email": "sarah@example.com",
    "city": "Bengaluru",
    "notes": "Requested pricing quote on landing page"
  }'`;

  const jsSnippet = `// Submit lead to MAKT CRM
async function sendLeadToCRM(leadData) {
  const response = await fetch("${endpointUrl}", {
    method: "POST",
    headers: {
      "Authorization": "Bearer ${apiKey}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: leadData.name,
      phone: leadData.phone,
      email: leadData.email,
      city: leadData.city,
      message: leadData.notes,
    }),
  });

  const result = await response.json();
  if (result.success) {
    console.log("Lead assigned to:", result.assignedTo?.username);
  }
}`;

  const pythonSnippet = `import requests

url = "${endpointUrl}"
headers = {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
}
payload = {
    "name": "David Kumar",
    "phone": "+919876543210",
    "email": "david@example.com",
    "city": "Hyderabad",
    "notes": "Incoming lead via Python worker"
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg font-bold text-slate-950 shadow-lg shadow-cyan-500/20">
            ⚡
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">API &amp; Webhooks</h1>
            <p className="text-sm text-slate-400">
              Ingest leads automatically from websites, forms, Zapier, and third-party apps into {organization.name}.
            </p>
          </div>
        </div>
      </div>

      {/* API Key Management Card */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Organization API Key</h2>
            <p className="text-xs text-slate-400">
              This bearer token authenticates your public ingestion requests. Keep it secret.
            </p>
          </div>
          <button
            onClick={handleRegenerateKey}
            disabled={isPending}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {isPending ? "Generating..." : "Roll New Key"}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              readOnly
              value={apiKey}
              className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 font-mono text-sm text-cyan-200 outline-none selection:bg-cyan-500/30"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              {showKey ? "Hide" : "Reveal"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(apiKey, setCopiedKey)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-95"
          >
            {copiedKey ? "Copied!" : "Copy Key"}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
          <strong>Security Note:</strong> Leads sent with this key will automatically be routed to online agents in <strong>{organization.name}</strong> according to your Round-Robin / Load-Balancing rules.
        </div>
      </div>

      {/* Ingestion Endpoint & Code Snippets */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Public Ingestion Endpoint</h2>
          <p className="text-xs text-slate-400">
            Accepts <code className="rounded bg-white/10 px-1 py-0.5 text-cyan-300">POST</code> requests with JSON payload. CORS is enabled globally.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-slate-200">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400">POST</span>
            <span className="truncate">{endpointUrl}</span>
          </div>
        </div>

        {/* Snippet Tabs */}
        <div className="border-b border-white/10">
          <div className="flex gap-4">
            {(["curl", "javascript", "python", "zapier"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveSnippetTab(tab)}
                className={`border-b-2 pb-2 text-xs font-bold uppercase tracking-wider transition ${
                  activeSnippetTab === tab
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "curl" ? "cURL" : tab === "javascript" ? "JavaScript" : tab === "python" ? "Python" : "Zapier / Webhooks"}
              </button>
            ))}
          </div>
        </div>

        {/* Code View */}
        <div className="relative mt-4">
          {activeSnippetTab === "curl" && (
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-xs text-slate-200">
                {curlSnippet}
              </pre>
              <button
                type="button"
                onClick={() => copyToClipboard(curlSnippet, setCopiedCurl)}
                className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
              >
                {copiedCurl ? "Copied!" : "Copy Code"}
              </button>
            </div>
          )}

          {activeSnippetTab === "javascript" && (
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-xs text-slate-200">
                {jsSnippet}
              </pre>
              <button
                type="button"
                onClick={() => copyToClipboard(jsSnippet, setCopiedJs)}
                className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
              >
                {copiedJs ? "Copied!" : "Copy Code"}
              </button>
            </div>
          )}

          {activeSnippetTab === "python" && (
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-xs text-slate-200">
                {pythonSnippet}
              </pre>
            </div>
          )}

          {activeSnippetTab === "zapier" && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/50 p-5 text-xs text-slate-300">
              <p className="font-semibold text-white">How to connect Zapier / Make / Webhooks:</p>
              <ol className="list-inside list-decimal space-y-2 text-slate-400">
                <li>Create a <strong>Webhooks by Zapier</strong> action with method <strong>POST</strong>.</li>
                <li>Set URL to <code className="text-cyan-300">{endpointUrl}</code></li>
                <li>Add header <code className="text-cyan-300">Authorization: Bearer {apiKey.slice(0, 14)}...</code></li>
                <li>Set payload type to <strong>JSON</strong> and map:
                  <ul className="ml-5 mt-1 list-disc text-slate-300">
                    <li><code className="text-amber-300">phone</code> (Required): e.g. <code className="text-slate-400">+919876543210</code></li>
                    <li><code className="text-amber-300">name</code>: Customer full name</li>
                    <li><code className="text-amber-300">email</code>: Customer email</li>
                    <li><code className="text-amber-300">city</code>: City / Region</li>
                    <li><code className="text-amber-300">message</code>: Form comments or requirement</li>
                  </ul>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Simulator & Live Tester */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-xl backdrop-blur-sm">
          <h2 className="text-base font-semibold text-white">Interactive Ingestion Simulator</h2>
          <p className="text-xs text-slate-400 mb-4">
            Test your endpoint right now. A lead will be ingested, distributed to an online agent, and recorded in your CRM.
          </p>

          <form onSubmit={handleRunSimulation} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase">Contact Name</label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase">Phone (with country code)</label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">Email</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">City</label>
                <input
                  type="text"
                  value={testCity}
                  onChange={(e) => setTestCity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase">Requirement / Notes</label>
              <textarea
                rows={2}
                value={testNotes}
                onChange={(e) => setTestNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={simulating}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {simulating ? "Sending Lead..." : "🚀 Send Test Ingestion"}
            </button>
          </form>
        </div>

        {/* Live Simulator Response Box */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Live Ingestion Inspector</h2>
            {simResult && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  simResult.status >= 200 && simResult.status < 300
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}
              >
                HTTP {simResult.status}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-xs">
            {simulating && (
              <div className="flex h-full items-center justify-center text-slate-400 animate-pulse">
                Sending HTTP POST /api/v1/leads/ingest...
              </div>
            )}
            {!simulating && !simResult && (
              <div className="flex h-full items-center justify-center text-slate-500">
                Submit the form on the left to inspect real-time JSON response.
              </div>
            )}
            {!simulating && simResult && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase">Response Payload:</p>
                <pre className="text-cyan-300">{JSON.stringify(simResult.data || simResult.error, null, 2)}</pre>
                {simResult.data?.assignedTo && (
                  <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    🎉 Lead automatically assigned to <strong>{simResult.data.assignedTo.username}</strong>!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Ingested Leads Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-base font-semibold text-white mb-1">Recent Organization Leads</h2>
        <p className="text-xs text-slate-400 mb-4">
          Latest leads ingested into {organization.name}.
        </p>

        {recentLeads.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-xs text-slate-500">
            No leads ingested yet. Send your first lead via the simulator above or your website webhook!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[11px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Phone</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Assigned Agent</th>
                  <th className="pb-3 text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 font-semibold text-white">{lead.displayName}</td>
                    <td className="py-3 font-mono text-slate-400">{lead.phone}</td>
                    <td className="py-3">
                      <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/20">
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {lead.assignedTo?.username ? (
                        <span className="font-semibold text-emerald-400">{lead.assignedTo.username}</span>
                      ) : (
                        <span className="text-slate-500">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {new Date(lead.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
