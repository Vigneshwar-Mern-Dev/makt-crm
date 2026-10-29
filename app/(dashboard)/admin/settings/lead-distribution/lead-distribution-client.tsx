"use client";

import { useState, useTransition } from "react";
import { saveDistributionConfigAction } from "@/app/lib/distribution-config-action";
import { useRouter } from "next/navigation";

type AgentStat = {
  memberId: string;
  userId: string;
  username: string;
  email: string;
  department: string | null;
  role: string;
  availabilityStatus: "ONLINE" | "BUSY" | "OFFLINE";
  lastAssignedAt: string | null;
  assignedCount: number;
  pendingCount: number;
  breachedCount: number;
};

type Stats = {
  config: {
    leadDistributionEnabled: boolean;
    distributionMode: string;
    responseSlaMinutes: number;
    autoReassignOnBreach: boolean;
  } | null;
  metrics: {
    totalLeads: number;
    activeNewLeads: number;
    breachedLeads: number;
    metSlaLeads: number;
    slaComplianceRate: number;
  };
  agents: AgentStat[];
};

const SLA_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
];

const STATUS_INDICATOR: Record<string, { dot: string; label: string }> = {
  ONLINE: { dot: "bg-emerald-400", label: "Online" },
  BUSY: { dot: "bg-amber-400", label: "Busy" },
  OFFLINE: { dot: "bg-slate-500", label: "Offline" },
};

export function LeadDistributionClient({ stats }: { stats: Stats }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(stats.config?.leadDistributionEnabled ?? true);
  const [mode, setMode] = useState<"ROUND_ROBIN" | "LOAD_BALANCED">(
    (stats.config?.distributionMode as "ROUND_ROBIN" | "LOAD_BALANCED") ?? "ROUND_ROBIN"
  );
  const [slaMinutes, setSlaMinutes] = useState(stats.config?.responseSlaMinutes ?? 15);
  const [autoReassign, setAutoReassign] = useState(stats.config?.autoReassignOnBreach ?? true);
  const [saveMessage, setSaveMessage] = useState("");

  function handleSave() {
    setSaveMessage("");
    startTransition(async () => {
      const result = await saveDistributionConfigAction({
        enabled,
        mode,
        slaMinutes,
        autoReassign,
      });
      if (result.success) {
        setSaveMessage("Settings saved.");
        router.refresh();
      } else {
        setSaveMessage("Failed to save settings.");
      }
    });
  }

  const { metrics, agents } = stats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Lead Distribution</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure how incoming call leads are auto-assigned to your team.
        </p>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Leads", value: metrics.totalLeads, color: "text-white" },
          { label: "Pending (NEW)", value: metrics.activeNewLeads, color: "text-amber-400" },
          { label: "SLA Breaches", value: metrics.breachedLeads, color: "text-red-400" },
          {
            label: "SLA Compliance",
            value: `${metrics.slaComplianceRate}%`,
            color: metrics.slaComplianceRate >= 90 ? "text-emerald-400" : metrics.slaComplianceRate >= 70 ? "text-amber-400" : "text-red-400",
          },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{m.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Configuration Card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Distribution Settings</h2>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Auto-Distribution</p>
            <p className="text-xs text-slate-400">Automatically assign new leads to available agents</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={[
              "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
              enabled ? "bg-cyan-500" : "bg-slate-700",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transition-transform",
                enabled ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {/* Distribution Strategy */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-white">Strategy</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                value: "ROUND_ROBIN" as const,
                label: "Round Robin",
                desc: "Distribute leads evenly by rotating through agents in order.",
                icon: (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16-1.64-1.64A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                value: "LOAD_BALANCED" as const,
                label: "Load Balanced",
                desc: "Assign to the agent with the fewest pending leads.",
                icon: (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 16v-5M12 16V8M16 16v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ),
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={[
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                  mode === opt.value
                    ? "border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/20"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20",
                ].join(" ")}
              >
                <div className={mode === opt.value ? "text-cyan-400" : "text-slate-500"}>
                  {opt.icon}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${mode === opt.value ? "text-cyan-300" : "text-white"}`}>
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Response SLA */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-white">Response SLA Window</p>
          <p className="text-xs text-slate-400">Maximum time an agent has to respond to an assigned lead</p>
          <div className="flex flex-wrap gap-2">
            {SLA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSlaMinutes(opt.value)}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-medium transition",
                  slaMinutes === opt.value
                    ? "bg-cyan-500 text-white"
                    : "border border-white/10 text-slate-400 hover:border-white/20 hover:text-white",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Reassign Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Auto-Reassign on SLA Breach</p>
            <p className="text-xs text-slate-400">
              Automatically move lead to another available agent if the SLA deadline passes
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoReassign}
            onClick={() => setAutoReassign(!autoReassign)}
            className={[
              "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
              autoReassign ? "bg-cyan-500" : "bg-slate-700",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transition-transform",
                autoReassign ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={[
              "h-10 rounded-lg bg-cyan-500 px-6 text-sm font-semibold text-white transition hover:bg-cyan-400",
              isPending ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {isPending ? "Saving…" : "Save Settings"}
          </button>
          {saveMessage && (
            <p className={`text-sm ${saveMessage.includes("Failed") ? "text-red-400" : "text-emerald-400"}`}>
              {saveMessage}
            </p>
          )}
        </div>
      </div>

      {/* Agent Distribution Table */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Agent Distribution Breakdown</h2>

        {agents.length === 0 ? (
          <p className="text-sm text-slate-500">No team members found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4 text-right">Assigned</th>
                  <th className="pb-3 px-4 text-right">Pending</th>
                  <th className="pb-3 px-4 text-right">SLA Breached</th>
                  <th className="pb-3 pl-4 text-right">Last Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {agents.map((agent) => {
                  const status = STATUS_INDICATOR[agent.availabilityStatus] || STATUS_INDICATOR.OFFLINE;

                  return (
                    <tr key={agent.memberId} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-bold">
                            {agent.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{agent.username}</p>
                            <p className="text-xs text-slate-500">{agent.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                          <span className="text-slate-300">{status.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-white tabular-nums">
                        {agent.assignedCount}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className={agent.pendingCount > 0 ? "text-amber-400 font-medium" : "text-slate-500"}>
                          {agent.pendingCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className={agent.breachedCount > 0 ? "text-red-400 font-medium" : "text-slate-500"}>
                          {agent.breachedCount}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right text-xs text-slate-500 tabular-nums">
                        {agent.lastAssignedAt
                          ? new Date(agent.lastAssignedAt).toLocaleString()
                          : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
