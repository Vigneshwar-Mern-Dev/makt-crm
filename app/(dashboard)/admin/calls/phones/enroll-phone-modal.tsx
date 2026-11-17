"use client";

import { useState } from "react";

export function EnrollPhoneModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/call-tracker/pair/generate", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate pairing code");
      }
      setCode(data.code);
      setExpiresIn(data.expiresInSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate pairing code");
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setIsOpen(true);
    handleGenerate();
  };

  const closeModal = () => {
    setIsOpen(false);
    setCode(null);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/20"
      >
        <span>📱</span> Enroll New Phone (Pairing Code)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Enroll Android Phone</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Secure one-time pairing without exposing API secrets
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div className="my-8 flex flex-col items-center justify-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                <p className="text-xs text-slate-400">Generating secure pairing code...</p>
              </div>
            ) : error ? (
              <div className="my-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                <p className="font-bold">Error</p>
                <p className="mt-1">{error}</p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="mt-3 rounded border border-rose-400/30 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
                >
                  Try Again
                </button>
              </div>
            ) : code ? (
              <div className="my-6 space-y-4">
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-5 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                    One-Time 6-Digit Code
                  </p>
                  <p className="mt-2 font-mono text-4xl font-extrabold tracking-widest text-white">
                    {code.slice(0, 3)} {code.slice(3)}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Expires in {Math.round((expiresIn || 900) / 60)} minutes · Single use
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-white/5 bg-black/30 p-3.5 text-xs text-slate-300">
                  <p className="font-semibold text-white">How to connect on the phone:</p>
                  <ol className="list-inside list-decimal space-y-1 text-slate-400">
                    <li>Open the MAKT Android App on the staff member&apos;s phone.</li>
                    <li>Ensure Server URL is <code className="text-cyan-300">https://crm.planle.com</code>.</li>
                    <li>Enter the 6-digit Pairing Code shown above.</li>
                    <li>Tap <strong className="text-white">&quot;Pair &amp; Connect&quot;</strong>.</li>
                  </ol>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
