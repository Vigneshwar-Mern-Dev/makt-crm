"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updateAvailabilityAction } from "@/app/lib/availability-action";

type Status = "ONLINE" | "BUSY" | "OFFLINE";

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; dot: string; ring: string }> = {
  ONLINE: {
    label: "Available",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
  },
  BUSY: {
    label: "Busy",
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
  },
  OFFLINE: {
    label: "Offline",
    color: "text-slate-500",
    bg: "bg-slate-500/15",
    dot: "bg-slate-500",
    ring: "ring-slate-500/30",
  },
};

export function AgentAvailabilityPill({
  initialStatus,
}: {
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const config = STATUS_CONFIG[status];

  function handleChange(newStatus: Status) {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    setStatus(newStatus);
    setIsOpen(false);

    startTransition(async () => {
      const result = await updateAvailabilityAction(newStatus);
      if (result.error) {
        // Revert on error
        setStatus(status);
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={[
          "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all",
          config.bg,
          config.color,
          config.ring,
          isPending ? "opacity-60" : "hover:brightness-125 cursor-pointer",
        ].join(" ")}
      >
        <span className="relative flex h-2 w-2">
          {status === "ONLINE" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
        </span>
        {config.label}
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0f1219] shadow-2xl shadow-black/50">
          {(["ONLINE", "BUSY", "OFFLINE"] as Status[]).map((s) => {
            const c = STATUS_CONFIG[s];
            const isActive = s === status;

            return (
              <button
                key={s}
                type="button"
                onClick={() => handleChange(s)}
                className={[
                  "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition",
                  isActive
                    ? "bg-white/5 font-semibold text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                <span className="flex-1">{c.label}</span>
                {isActive && (
                  <svg className="h-4 w-4 text-cyan-300" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
