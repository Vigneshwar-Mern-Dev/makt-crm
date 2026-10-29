"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/lib/auth-actions";
import { CallCenterLiveSync } from "../../components/call-center-live-sync";
import { UserCallPopup } from "./user-call-popup";

type UserShellProps = {
  children: ReactNode;
  user: {
    username: string;
    email: string;
  };
  workload: {
    callFollowups: number;
    callOpenLeads: number;
    openTasks: number;
    overdueTasks: number;
  };
};

const navItems = [
  {
    href: "/user",
    label: "Dashboard",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/user/tasks",
    label: "Tasks",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/user/calls",
    label: "Call Center",
    icon: (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M7 4h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 5 6.2 2 2 0 0 1 7 4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
    children: [
      { href: "/user/calls", label: "Overview" },
      { href: "/user/calls/callbacks", label: "Open Leads & Queue" },
      { href: "/user/calls/assigned", label: "My Assigned Leads" },
    ],
  },
];

const userThemeBase = {
  panel: "bg-[#0b0b0a]",
  page: "bg-[#080807]",
  header: "bg-[#080807]/90",
  accentSubtleText: "text-zinc-500",
};

const userAccentThemes = [
  {
    accent: "#facc15",
    accentHover: "#fde047",
    accentText: "#fde68a",
    accentMuted: "rgba(250, 204, 21, 0.10)",
    accentBorder: "rgba(250, 204, 21, 0.24)",
    accentGlow: "rgba(250, 204, 21, 0.18)",
    activeText: "#18181b",
  },
  {
    accent: "#34d399",
    accentHover: "#6ee7b7",
    accentText: "#a7f3d0",
    accentMuted: "rgba(52, 211, 153, 0.10)",
    accentBorder: "rgba(52, 211, 153, 0.24)",
    accentGlow: "rgba(52, 211, 153, 0.18)",
    activeText: "#022c22",
  },
  {
    accent: "#fb7185",
    accentHover: "#fda4af",
    accentText: "#fecdd3",
    accentMuted: "rgba(251, 113, 133, 0.10)",
    accentBorder: "rgba(251, 113, 133, 0.24)",
    accentGlow: "rgba(251, 113, 133, 0.18)",
    activeText: "#3f0a13",
  },
  {
    accent: "#38bdf8",
    accentHover: "#7dd3fc",
    accentText: "#bae6fd",
    accentMuted: "rgba(56, 189, 248, 0.10)",
    accentBorder: "rgba(56, 189, 248, 0.24)",
    accentGlow: "rgba(56, 189, 248, 0.18)",
    activeText: "#082f49",
  },
  {
    accent: "#a78bfa",
    accentHover: "#c4b5fd",
    accentText: "#ddd6fe",
    accentMuted: "rgba(167, 139, 250, 0.10)",
    accentBorder: "rgba(167, 139, 250, 0.24)",
    accentGlow: "rgba(167, 139, 250, 0.18)",
    activeText: "#1e1b4b",
  },
  {
    accent: "#fb923c",
    accentHover: "#fdba74",
    accentText: "#fed7aa",
    accentMuted: "rgba(251, 146, 60, 0.10)",
    accentBorder: "rgba(251, 146, 60, 0.24)",
    accentGlow: "rgba(251, 146, 60, 0.18)",
    activeText: "#431407",
  },
] as const;

function getUserAccentTheme(user: UserShellProps["user"]) {
  const key = `${user.username}:${user.email}`.toLowerCase();
  const hash = Array.from(key).reduce(
    (total, char, index) => total + char.charCodeAt(0) * (index + 1),
    0,
  );

  return userAccentThemes[hash % userAccentThemes.length];
}

export function UserShell({ children, user, workload }: UserShellProps) {
  const pathname = usePathname();
  const initials = user.username.slice(0, 2).toUpperCase() || "US";
  const callCenter = navItems.find((item) => item.href === "/user/calls");
  const accentTheme = getUserAccentTheme(user);
  const theme = userThemeBase;
  const themeVars = {
    "--user-accent": accentTheme.accent,
    "--user-accent-hover": accentTheme.accentHover,
    "--user-accent-text": accentTheme.accentText,
    "--user-accent-muted": accentTheme.accentMuted,
    "--user-accent-border": accentTheme.accentBorder,
    "--user-accent-glow": accentTheme.accentGlow,
    "--user-active-text": accentTheme.activeText,
  } as CSSProperties;

  return (
    <main
      className={`h-screen overflow-hidden ${theme.page} text-white`}
      style={themeVars}
    >
      <div className="flex h-full min-h-0">
        <aside className={`hidden h-full w-72 shrink-0 overflow-y-auto border-r border-white/10 ${theme.panel} p-5 lg:flex lg:flex-col`}>
          <Link className="mb-8 flex items-center gap-3" href="/user">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--user-accent)] text-sm font-black text-[var(--user-active-text)]">
              MA
            </span>
            <span>
              <span className="block text-base font-bold">MAKT</span>
              <span className={`text-xs ${theme.accentSubtleText}`}>User workspace</span>
            </span>
          </Link>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/user" && pathname.startsWith(item.href));

              return (
                <div key={item.href}>
                  <Link
                    className={[
                      "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition cursor-pointer",
                      isActive
                        ? "bg-[var(--user-accent)] text-[var(--user-active-text)] font-semibold"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                    href={item.href}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.children ? (
                      <svg
                        aria-hidden="true"
                        className={[
                          "h-4 w-4 transition-transform",
                          isActive ? "rotate-90" : "",
                        ].join(" ")}
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="m9 18 6-6-6-6"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    ) : null}
                  </Link>

                  {item.children && isActive ? (
                    <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const isChildActive = pathname === child.href;

                        return (
                          <Link
                            className={[
                              "block rounded-lg px-3 py-2 text-sm transition cursor-pointer",
                              isChildActive
                                ? "bg-white/10 text-white font-medium"
                                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200",
                            ].join(" ")}
                            href={child.href}
                            key={child.href}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--user-accent-text)]">
                Workload
              </p>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--user-accent)]" />
            </div>
            <dl className="mt-4 space-y-3">
              {[
                ["Call follow-ups", workload.callFollowups],
                ["Call leads", workload.callOpenLeads],
                ["Open tasks", workload.openTasks],
                ["Overdue", workload.overdueTasks],
              ].map(([label, value]) => (
                <div className="flex items-center justify-between gap-4" key={label}>
                  <dt className="text-sm text-zinc-400">{label}</dt>
                  <dd className="min-w-8 rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-right text-sm font-bold text-white">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--user-accent)] text-sm font-bold text-[var(--user-active-text)]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.username}</p>
                <p className="truncate text-xs text-zinc-500">{user.email}</p>
              </div>
            </div>
            <form action={logoutAction} className="mt-4">
              <button
                className="h-10 w-full rounded-lg border border-white/10 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
                type="submit"
              >
                Logout
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className={`z-20 shrink-0 border-b border-white/10 ${theme.header} px-5 py-4 backdrop-blur md:px-8`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--user-accent-text)]">
                  Workspace
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Assigned tasks, lead work, and follow-up activity.
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--user-accent)] text-sm font-bold text-[var(--user-active-text)] lg:hidden">
                {initials}
              </div>
            </div>

            <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/user" && pathname.startsWith(item.href));

                return (
                  <Link
                    className={[
                      "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium",
                      isActive
                        ? "bg-[var(--user-accent)] text-[var(--user-active-text)]"
                        : "border border-white/10 text-zinc-300",
                    ].join(" ")}
                    href={item.href}
                    key={item.href}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {pathname.startsWith("/user/calls") ? (
              <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
                {callCenter?.children?.map((child) => (
                  <Link
                    className={[
                      "h-9 shrink-0 rounded-lg px-3 text-sm font-medium leading-9",
                      pathname === child.href
                        ? "bg-white/10 text-white"
                        : "border border-white/10 text-zinc-400",
                    ].join(" ")}
                    href={child.href}
                    key={child.href}
                  >
                    {child.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">{children}</div>
        </div>
      </div>
      {pathname.startsWith("/user/calls") ? <CallCenterLiveSync /> : null}
      <UserCallPopup />
    </main>
  );
}
