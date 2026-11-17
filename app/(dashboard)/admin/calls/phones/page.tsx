import { db } from "@/app/lib/db";
import { EnrollPhoneModal } from "./enroll-phone-modal";
import {
  CallCenterTabs,
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatCard,
  StatusBadge,
  formatDateTime,
} from "../call-ui";

function getPhoneHealth(phone: {
  isActive: boolean;
  lastSeenAt: Date | null;
  batteryPercent: number | null;
  isCharging: boolean | null;
  pendingSyncCount: number | null;
  lastSyncError: string | null;
  permissionStatus: unknown;
}, currentTime: Date) {
  const isStale = !phone.lastSeenAt || currentTime.getTime() - phone.lastSeenAt.getTime() > 15 * 60 * 1000;
  const hasPermissionProblem = getBrokenPermissions(phone.permissionStatus).length > 0;
  if (!phone.isActive) return { label: "Inactive", tone: "rose" as const, detail: "Device registration is disabled" };
  if (isStale) return { label: "Offline", tone: "rose" as const, detail: "No heartbeat in the last 15 minutes" };
  if (phone.lastSyncError) return { label: "Sync error", tone: "rose" as const, detail: phone.lastSyncError };
  if (hasPermissionProblem) return { label: "Permission issue", tone: "amber" as const, detail: "One or more Android permissions need attention" };
  if ((phone.pendingSyncCount || 0) > 0) return { label: "Sync pending", tone: "amber" as const, detail: `${phone.pendingSyncCount} events waiting to sync` };
  if ((phone.batteryPercent || 100) < 20 && !phone.isCharging) return { label: "Low battery", tone: "amber" as const, detail: "Charge this phone soon" };
  return { label: "Healthy", tone: "emerald" as const, detail: "Ready to receive call events" };
}

function formatRelative(value: Date | null, currentTime: Date) {
  if (!value) return "Never";

  const diffMs = Math.max(0, currentTime.getTime() - value.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getBrokenPermissions(permissionStatus: unknown) {
  if (!permissionStatus || typeof permissionStatus !== "object" || Array.isArray(permissionStatus)) {
    return [];
  }

  return Object.entries(permissionStatus)
    .filter(([, value]) => value === false || value === "denied" || value === "missing")
    .map(([key]) => key);
}

export default async function AdminCompanyPhonesPage() {
  const phones = await db.companyPhone.findMany({
    include: { _count: { select: { events: true, sessions: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const currentTime = new Date();
  const phoneRows = phones.map((phone) => ({ ...phone, health: getPhoneHealth(phone, currentTime) }));
  const healthyCount = phoneRows.filter((phone) => phone.health.label === "Healthy").length;
  const pendingCount = phoneRows.reduce((total, phone) => total + (phone.pendingSyncCount || 0), 0);
  const problemCount = phoneRows.filter((phone) => phone.health.tone !== "emerald").length;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader description="Monitor the Android phones feeding call events into CRM. Offline devices and sync backlogs should be fixed before they create blind spots." title="Company phones" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CallCenterTabs />
        <div className="flex items-center gap-2">
          <a
            href="/downloads/makt-tracker.apk"
            download="makt-tracker.apk"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25"
          >
            📲 Download Android APK
          </a>
          <EnrollPhoneModal />
        </div>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Registered Android phones" label="Devices" value={phones.length} />
        <StatCard detail="Online without warnings" label="Healthy" tone="emerald" value={`${healthyCount}/${phones.length}`} />
        <StatCard detail="Events waiting for upload" label="Pending sync" tone={pendingCount ? "amber" : "cyan"} value={pendingCount} />
        <StatCard detail="Offline, sync error, low battery, or permissions" label="Needs action" tone={problemCount ? "rose" : "emerald"} value={problemCount} />
      </section>
      <Panel>
        <PanelTitle description="A phone is offline after 15 minutes without a heartbeat." title="Device health" />
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {phoneRows.map((phone) => (
            <article className="rounded-xl border border-white/10 bg-black/20 p-4" key={phone.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-white">{phone.label}</p>
                  <p className="mt-1 text-sm font-bold text-cyan-200">{phone.phoneNumber}</p>
                </div>
                <StatusBadge tone={phone.health.tone}>{phone.health.label}</StatusBadge>
              </div>
              <p className="mt-3 text-xs text-slate-400">{phone.health.detail}</p>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-white/5 bg-white/[0.025] p-3 text-xs sm:grid-cols-3">
                <div><p className="text-slate-500">Last seen</p><p className="mt-1 font-bold text-slate-200">{formatRelative(phone.lastSeenAt, currentTime)}</p><p className="mt-1 text-[10px] text-slate-600">{formatDateTime(phone.lastSeenAt)}</p></div>
                <div><p className="text-slate-500">Battery</p><p className="mt-1 font-bold text-slate-200">{phone.batteryPercent ?? "N/A"}{phone.batteryPercent === null ? "" : "%"}</p><p className="mt-1 text-[10px] text-slate-600">{phone.isCharging ? `Charging${phone.chargingType ? ` / ${phone.chargingType}` : ""}` : "Not charging"}</p></div>
                <div><p className="text-slate-500">Network</p><p className="mt-1 font-bold text-slate-200">{phone.networkType || "N/A"}</p></div>
                <div><p className="text-slate-500">Sessions</p><p className="mt-1 font-bold text-slate-200">{phone._count.sessions}</p></div>
                <div><p className="text-slate-500">Events</p><p className="mt-1 font-bold text-slate-200">{phone._count.events}</p></div>
                <div><p className="text-slate-500">Pending</p><p className="mt-1 font-bold text-slate-200">{phone.pendingSyncCount || 0}</p></div>
                <div><p className="text-slate-500">Last sync</p><p className="mt-1 font-bold text-slate-200">{formatRelative(phone.lastSuccessfulSyncAt, currentTime)}</p></div>
                <div><p className="text-slate-500">Retries</p><p className="mt-1 font-bold text-slate-200">{phone.syncRetryCount || 0}</p></div>
                <div><p className="text-slate-500">Permissions</p><p className="mt-1 font-bold text-slate-200">{getBrokenPermissions(phone.permissionStatus).length ? `${getBrokenPermissions(phone.permissionStatus).length} issue(s)` : "OK"}</p></div>
              </div>
              {phone.lastSyncError ? (
                <div className="mt-3 rounded-lg border border-rose-300/15 bg-rose-300/10 p-3 text-xs text-rose-100">
                  <p className="font-black">Last sync error</p>
                  <p className="mt-1 break-words text-rose-200/90">{phone.lastSyncError}</p>
                  <p className="mt-2 text-[10px] text-rose-200/60">{formatDateTime(phone.lastSyncErrorAt)}</p>
                </div>
              ) : null}
              {getBrokenPermissions(phone.permissionStatus).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {getBrokenPermissions(phone.permissionStatus).map((permission) => (
                    <StatusBadge key={permission} tone="amber">{permission}</StatusBadge>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span>{phone.deviceModel || "Unknown model"}</span>
                <span>Android {phone.androidVersion || "N/A"}</span>
                <span>App {phone.appVersion || "N/A"}</span>
              </div>
              <p className="mt-2 truncate font-mono text-[10px] text-slate-600">{phone.deviceId}</p>
            </article>
          ))}
          {!phones.length ? <EmptyState>No company phones registered yet.</EmptyState> : null}
        </div>
      </Panel>
    </div>
  );
}
