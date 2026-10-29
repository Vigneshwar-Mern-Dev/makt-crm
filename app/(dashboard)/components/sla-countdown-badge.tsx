"use client";

import { useState, useEffect } from "react";

type SlaCountdownBadgeProps = {
  slaExpiresAt: string | Date | null;
  slaBreached?: boolean;
  firstResponseAt?: string | Date | null;
};

function formatCountdown(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function SlaCountdownBadge({
  slaExpiresAt,
  slaBreached,
  firstResponseAt,
}: SlaCountdownBadgeProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!slaExpiresAt || firstResponseAt) {
      setRemaining(null);
      return;
    }

    const deadline = new Date(slaExpiresAt).getTime();

    function tick() {
      const diff = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(diff);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [slaExpiresAt, firstResponseAt]);

  // Already responded — SLA met
  if (firstResponseAt) {
    if (slaBreached) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400 ring-1 ring-red-500/20">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Late Response
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        SLA Met
      </span>
    );
  }

  // No SLA set
  if (!slaExpiresAt || remaining === null) {
    return null;
  }

  // Breached
  if (remaining === 0 || slaBreached) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400 ring-1 ring-red-500/20 animate-pulse">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
        </span>
        SLA Breached
      </span>
    );
  }

  // Warning — less than 3 minutes
  if (remaining <= 180) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/20 tabular-nums">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        {formatCountdown(remaining)} left
      </span>
    );
  }

  // Normal — plenty of time
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-400 ring-1 ring-cyan-500/20 tabular-nums">
      <span className="h-2 w-2 rounded-full bg-cyan-400" />
      {formatCountdown(remaining)} left
    </span>
  );
}
