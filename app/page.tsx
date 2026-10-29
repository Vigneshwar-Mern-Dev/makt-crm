"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getThemeSnapshot(): "dark" | "light" {
  try {
    const saved = localStorage.getItem("makt-landing-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function getThemeServerSnapshot(): "dark" | "light" {
  return "dark";
}

export default function Home() {
  const [overrideTheme, setOverrideTheme] = useState<"dark" | "light" | null>(null);
  const systemTheme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getThemeServerSnapshot);
  const theme = overrideTheme ?? systemTheme;

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setOverrideTheme(next);
    try {
      localStorage.setItem("makt-landing-theme", next);
    } catch {
      // storage quota or disabled
    }
  }

  const isDark = theme === "dark";

  return (
    <main
      className={[
        "relative min-h-screen overflow-x-hidden font-sans transition-colors duration-500",
        isDark ? "bg-[#060911] text-slate-100 selection:bg-cyan-400 selection:text-slate-950" : "bg-[#f8fafc] text-slate-900 selection:bg-cyan-500 selection:text-white",
      ].join(" ")}
    >
      {/* Dynamic Ambient Glow Mesh */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Glow Orb 1 - Top Left */}
        <motion.div
          animate={{ y: [0, 25, 0], opacity: isDark ? [0.2, 0.4, 0.2] : [0.35, 0.55, 0.35] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className={[
            "absolute left-[-8%] top-[-5%] h-[550px] w-[550px] rounded-full blur-[140px]",
            isDark ? "bg-cyan-500/20" : "bg-cyan-400/30",
          ].join(" ")}
        />
        {/* Glow Orb 2 - Bottom Right */}
        <motion.div
          animate={{ y: [0, -30, 0], opacity: isDark ? [0.15, 0.35, 0.15] : [0.25, 0.45, 0.25] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className={[
            "absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full blur-[160px]",
            isDark ? "bg-indigo-600/20" : "bg-indigo-300/40",
          ].join(" ")}
        />
        {/* Glow Orb 3 - Center Violet Accent */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: isDark ? [0.1, 0.25, 0.1] : [0.2, 0.35, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className={[
            "absolute left-[35%] top-[30%] h-[400px] w-[400px] rounded-full blur-[130px]",
            isDark ? "bg-violet-500/15" : "bg-violet-300/30",
          ].join(" ")}
        />

        {/* Subtle Architectural Grid Lines */}
        <div
          className={[
            "absolute inset-0 bg-[size:56px_56px] opacity-40",
            isDark
              ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)]"
              : "bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)]",
          ].join(" ")}
          style={{ maskImage: "radial-gradient(ellipse at center, black 50%, transparent 90%)" }}
        />
      </div>

      {/* Sticky Glass Navbar */}
      <motion.nav
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={[
          "sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-300",
          isDark
            ? "border-white/[0.08] bg-[#070b16]/80 text-white"
            : "border-slate-200/90 bg-white/80 text-slate-900 shadow-xs",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Brand Logo with Glow Badge */}
          <Link href="/" className="group flex items-center gap-3">
            <span
              className={[
                "grid h-10 w-10 place-items-center rounded-xl text-sm font-black transition-transform duration-300 group-hover:scale-105",
                isDark ? "bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)]" : "bg-cyan-600 text-white shadow-md shadow-cyan-600/30",
              ].join(" ")}
            >
              MA
            </span>
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-base font-extrabold tracking-wider">
                MAKT
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </span>
              <span className={["text-[10px] font-semibold tracking-widest uppercase", isDark ? "text-slate-400" : "text-slate-500"].join(" ")}>
                Enterprise CRM
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wide uppercase">
            <a href="#features" className={["transition", isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"].join(" ")}>
              Features
            </a>
            <a href="#architecture" className={["transition", isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"].join(" ")}>
              Architecture
            </a>
            <a href="#metrics" className={["transition", isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"].join(" ")}>
              SLO Metrics
            </a>
            <a href="#workflow" className={["transition", isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"].join(" ")}>
              Workflow
            </a>
          </div>

          {/* Right Action Hub: Theme Switcher & Login */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? "Light" : "Dark"} mode`}
              className={[
                "flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 hover:scale-105",
                isDark
                  ? "border-white/10 bg-white/5 text-amber-300 hover:border-white/20 hover:bg-white/10"
                  : "border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200",
              ].join(" ")}
              type="button"
            >
              {isDark ? (
                /* Sun Icon */
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                /* Moon Icon */
                <svg className="h-4 w-4 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <Link
              href="/login"
              className={[
                "flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold tracking-wide transition-all duration-300",
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-white/5"
                  : "text-slate-700 hover:text-slate-950 hover:bg-slate-100",
              ].join(" ")}
            >
              Sign In
            </Link>

            <Link
              href="/register"
              className={[
                "flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold tracking-wide transition-all duration-300 shadow-sm",
                isDark
                  ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                  : "bg-cyan-600 text-white hover:bg-cyan-500 hover:shadow-md",
              ].join(" ")}
            >
              <span>Create Org</span>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pb-20 pt-16 text-center md:pt-24 lg:pt-28">
        {/* Status Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={[
            "mb-8 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-semibold backdrop-blur-xl transition-colors",
            isDark
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
              : "border-cyan-600/30 bg-cyan-50 text-cyan-800",
          ].join(" ")}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Next-Gen Telecalling & WhatsApp AI CRM</span>
          <span className={["rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", isDark ? "bg-white/10 text-white" : "bg-cyan-200/60 text-cyan-900"].join(" ")}>
            v2.4 Ready
          </span>
        </motion.div>

        {/* Primary Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-5xl text-5xl font-black tracking-tight leading-[1.08] sm:text-6xl md:text-7xl lg:text-8xl"
        >
          <span>Intelligent Telecalling &</span>{" "}
          <span
            className={[
              "bg-gradient-to-r bg-clip-text text-transparent",
              isDark
                ? "from-cyan-300 via-teal-200 to-indigo-400"
                : "from-cyan-600 via-blue-700 to-indigo-800",
            ].join(" ")}
          >
            WhatsApp Automation.
          </span>
        </motion.h1>

        {/* Subtitle Statement */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={[
            "mt-8 max-w-3xl text-lg font-normal leading-relaxed md:text-xl",
            isDark ? "text-slate-300" : "text-slate-600",
          ].join(" ")}
        >
          MAKT empowers high-velocity telecalling teams with real-time Android call tracking,
          bilingual Tamil & English auto-reply bots, anti-ban SpinTax broadcast queues, and 1-click Google Sheets sync.
        </motion.p>

        {/* CTA Group */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/register"
            className={[
              "group flex h-13 items-center gap-3 rounded-2xl px-8 text-base font-bold shadow-lg transition-all duration-300 hover:scale-105",
              isDark
                ? "bg-cyan-400 text-slate-950 shadow-cyan-400/25 hover:bg-cyan-300"
                : "bg-cyan-600 text-white shadow-cyan-600/30 hover:bg-cyan-500",
            ].join(" ")}
          >
            <span>Create Your Organization</span>
            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>

          <Link
            href="/login"
            className={[
              "flex h-13 items-center gap-2 rounded-2xl border px-8 text-base font-semibold backdrop-blur-xl transition-all duration-300 hover:scale-105",
              isDark
                ? "border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
                : "border-slate-300 bg-white text-slate-800 shadow-xs hover:border-slate-400 hover:bg-slate-50",
            ].join(" ")}
          >
            <span>Sign In to Console</span>
          </Link>
        </motion.div>

        {/* Interactive Live HUD Simulation Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 w-full max-w-4xl"
        >
          <div
            className={[
              "relative overflow-hidden rounded-3xl border p-6 text-left shadow-2xl backdrop-blur-2xl transition-all",
              isDark
                ? "border-white/10 bg-[#0c121e]/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]"
                : "border-slate-200 bg-white/95 shadow-xl shadow-slate-200/50",
            ].join(" ")}
          >
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b pb-4 mb-5 border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className={["ml-3 text-xs font-mono font-medium", isDark ? "text-slate-400" : "text-slate-500"].join(" ")}>
                  crm-live-hud: telecalling-node-active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  Live Stream
                </span>
              </div>
            </div>

            {/* Simulated Live Call Card */}
            <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
              <div
                className={[
                  "rounded-2xl border p-5 transition-all",
                  isDark
                    ? "border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.1)]"
                    : "border-emerald-300 bg-emerald-50/70",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                    Live Ringing Call
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-400 animate-pulse">
                    00:08s Ringing
                  </span>
                </div>
                <h2 className={["mt-3 text-xl font-black", isDark ? "text-white" : "text-slate-900"].join(" ")}>
                  Suresh Kumar (Chennai)
                </h2>
                <p className="mt-1 font-mono text-sm font-semibold text-cyan-400">+91 98765 43210</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className={["rounded-md px-2.5 py-1", isDark ? "bg-white/10 text-slate-300" : "bg-white text-slate-700 shadow-xs"].join(" ")}>
                    SIM 1 (Sales Line 1)
                  </span>
                  <span className={["rounded-md px-2.5 py-1", isDark ? "bg-white/10 text-slate-300" : "bg-white text-slate-700 shadow-xs"].join(" ")}>
                    Commercial Shop (80 sqft)
                  </span>
                  <span className="rounded-md bg-cyan-500/20 px-2.5 py-1 font-semibold text-cyan-300">
                    Auto-WhatsApp Dispatched
                  </span>
                </div>
              </div>

              {/* Status Telemetry */}
              <div className="flex flex-col justify-between gap-3">
                <div className={[
                  "rounded-xl border p-3.5 text-xs",
                  isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50",
                ].join(" ")}>
                  <p className={isDark ? "text-slate-400" : "text-slate-500"}>WhatsApp SpinTax Variant</p>
                  <p className={["mt-1 font-mono font-medium truncate", isDark ? "text-slate-200" : "text-slate-800"].join(" ")}>
                    வணக்கம் Suresh! உங்கள் ATM விண்ணப்ப விவரங்கள்...
                  </p>
                </div>
                <div className={[
                  "rounded-xl border p-3.5 text-xs",
                  isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50",
                ].join(" ")}>
                  <p className={isDark ? "text-slate-400" : "text-slate-500"}>Google Sheets Two-Way Sync</p>
                  <p className="mt-1 font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span>✓ Synced to Sheet in 1.4s</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="flex-1 rounded-xl bg-cyan-400 py-2.5 text-center text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Claim Call
                  </Link>
                  <Link
                    href="/login"
                    className={[
                      "flex-1 rounded-xl border py-2.5 text-center text-xs font-semibold transition",
                      isDark ? "border-white/10 text-slate-200 hover:bg-white/10" : "border-slate-300 text-slate-700 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    Open Drawer
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Production SLO & Performance Metric Ribbon */}
      <section
        id="metrics"
        className={[
          "border-y py-12 transition-colors",
          isDark ? "border-white/10 bg-black/40" : "border-slate-200 bg-white/70 shadow-xs",
        ].join(" ")}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          {[
            { metric: "99.98%", label: "System Availability", detail: "Zero-downtime cluster" },
            { metric: "< 500ms", label: "Live Ringing HUD Latency", detail: "Real-time call alert" },
            { metric: "100%", label: "Tamil + English AI Bot", detail: "Bilingual auto-reply" },
            { metric: "1-Click", label: "Google Sheets Two-Way", detail: "Instant webhook sync" },
          ].map((item, idx) => (
            <div key={idx} className="text-center">
              <p
                className={[
                  "text-3xl font-black md:text-4xl bg-gradient-to-r bg-clip-text text-transparent",
                  isDark ? "from-white to-cyan-300" : "from-slate-950 to-cyan-700",
                ].join(" ")}
              >
                {item.metric}
              </p>
              <p className={["mt-1.5 text-xs font-bold uppercase tracking-wider", isDark ? "text-slate-300" : "text-slate-800"].join(" ")}>
                {item.label}
              </p>
              <p className={["mt-0.5 text-xs font-medium", isDark ? "text-slate-500" : "text-slate-500"].join(" ")}>
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Core Architectural Features Grid */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-500">Full Capabilities</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
            Engineered For High-Converting Call Centers
          </h2>
          <p className={["mx-auto mt-4 max-w-2xl text-base", isDark ? "text-slate-400" : "text-slate-600"].join(" ")}>
            From the initial Android smartphone ring to automated WhatsApp drips, client form onboarding, and executive analytics.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Android Fleet Call Tracker",
              desc: "Turns physical Android smartphones into smart call centers. Detects incoming, missed, and outgoing calls in under 500ms.",
              icon: "📱",
              badge: "Hardware Ingestion",
            },
            {
              title: "Anti-Ban SpinTax Engine",
              desc: "Dynamic curly brace {Hi|வணக்கம்} template permutation generator prevents WhatsApp algorithms from flagging repeated messages.",
              icon: "🛡️",
              badge: "Anti-Spam Filter",
            },
            {
              title: "Bilingual AI Auto-Reply Bot",
              desc: "Intelligently parses customer replies in Tamil and English for STOP, INVESTMENT (முதலீடு), OFFICE (முகவரி), or URGENT CALL requests.",
              icon: "🤖",
              badge: "Tamil & English AI",
            },
            {
              title: "2-Way Live Chat Drawer",
              desc: "Operators review full customer call recordings, notes, and send instant bespoke WhatsApp messages right from the lead drawer.",
              icon: "💬",
              badge: "Agent Console",
            },
            {
              title: "Google Sheets Two-Way Sync",
              desc: "1-click sync pushes qualified leads to Google Sheets via Google Apps Script with daily agent save telemetry and warning recovery.",
              icon: "📊",
              badge: "Cloud Sheets Sync",
            },
            {
              title: "Client Form & CSV Export",
              desc: "Tokenized public client form (/f/[token]) captures property details, rental type, and Google Maps pin with formula injection defense.",
              icon: "🔒",
              badge: "Formula-Safe CSV",
            },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={[
                "group relative overflow-hidden rounded-3xl border p-8 backdrop-blur-xl transition-all duration-300",
                isDark
                  ? "border-white/10 bg-white/[0.02] hover:border-cyan-400/30 hover:bg-white/[0.04] hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                  : "border-slate-200 bg-white hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{feature.icon}</span>
                <span className={[
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                  isDark ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-700",
                ].join(" ")}>
                  {feature.badge}
                </span>
              </div>
              <h3 className={["mt-6 text-xl font-black", isDark ? "text-white" : "text-slate-900"].join(" ")}>
                {feature.title}
              </h3>
              <p className={["mt-3 text-sm leading-relaxed", isDark ? "text-slate-400" : "text-slate-600"].join(" ")}>
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Architecture & Workflow Diagram Section */}
      <section
        id="architecture"
        className={[
          "border-t py-24 transition-colors",
          isDark ? "border-white/10 bg-black/30" : "border-slate-200 bg-slate-50/80",
        ].join(" ")}
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-500">Pipeline Flow</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
              End-to-End Operational Pipeline
            </h2>
            <p className={["mx-auto mt-4 max-w-2xl text-base", isDark ? "text-slate-400" : "text-slate-600"].join(" ")}>
              How physical smartphones, the Next.js server engine, Google Sheets, and Chromium WhatsApp workers synchronize.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Call Ringing & Ingestion",
                desc: "Android smartphone intercepts customer call, syncs battery/carrier health, and triggers live browser HUD for CRM operators.",
              },
              {
                step: "02",
                title: "SpinTax Drip Automation",
                desc: "MAKT CRM assigns candidate message, passes through quiet-hour schedule rules, and routes to active linked Chromium worker.",
              },
              {
                step: "03",
                title: "Client Intake & Sheet Sync",
                desc: "Customer opens bilingual form (/f/[token]), submits property information, and operator confirms with 1-click Google Sheets export.",
              },
            ].map((step, idx) => (
              <div
                key={idx}
                className={[
                  "relative rounded-3xl border p-8 backdrop-blur-xl",
                  isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-white shadow-xs",
                ].join(" ")}
              >
                <span className="text-3xl font-black text-cyan-400 font-mono">
                  {step.step}
                </span>
                <h3 className={["mt-4 text-xl font-bold", isDark ? "text-white" : "text-slate-900"].join(" ")}>
                  {step.title}
                </h3>
                <p className={["mt-3 text-sm leading-relaxed", isDark ? "text-slate-400" : "text-slate-600"].join(" ")}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section id="workflow" className="mx-auto max-w-7xl px-6 py-20">
        <div
          className={[
            "relative overflow-hidden rounded-[36px] border p-10 text-center md:p-16 backdrop-blur-2xl transition-all",
            isDark
              ? "border-cyan-400/30 bg-gradient-to-br from-cyan-400/[0.1] via-indigo-950/20 to-black/60 shadow-[0_0_50px_rgba(34,211,238,0.15)]"
              : "border-cyan-300 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 shadow-xl",
          ].join(" ")}
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            Ready To Launch Your Organization Workspace?
          </h2>
          <p className={["mx-auto mt-4 max-w-xl text-base md:text-lg", isDark ? "text-slate-300" : "text-slate-600"].join(" ")}>
            Create your isolated multi-tenant CRM workspace in seconds, invite your telecallers, and scale operations.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className={[
                "flex h-12 items-center gap-2 rounded-xl px-8 text-sm font-bold shadow-md transition hover:scale-105",
                isDark
                  ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  : "bg-cyan-600 text-white hover:bg-cyan-500",
              ].join(" ")}
            >
              Start Organization Free →
            </Link>
            <Link
              href="/login"
              className={[
                "flex h-12 items-center gap-2 rounded-xl border px-8 text-sm font-semibold transition hover:scale-105",
                isDark
                  ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
              ].join(" ")}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className={[
          "border-t py-12 transition-colors",
          isDark ? "border-white/10 bg-[#04060b]" : "border-slate-200 bg-white",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <span
              className={[
                "grid h-8 w-8 place-items-center rounded-lg text-xs font-black",
                isDark ? "bg-cyan-400 text-slate-950" : "bg-cyan-600 text-white",
              ].join(" ")}
            >
              MA
            </span>
            <span className="text-sm font-extrabold tracking-wider">MAKT CRM</span>
            <span className={["text-xs", isDark ? "text-slate-500" : "text-slate-400"].join(" ")}>
              — Multi-Tenant SaaS Telecalling Platform
            </span>
          </div>

          <p className={["text-xs", isDark ? "text-slate-500" : "text-slate-500"].join(" ")}>
            &copy; 2026 MAKT Automation CRM. All rights reserved.
          </p>

          <div className="flex items-center gap-5 text-xs font-semibold">
            <Link href="/register" className={isDark ? "text-cyan-300 hover:text-white" : "text-cyan-600 hover:text-cyan-700"}>
              Create Organization
            </Link>
            <Link href="/login" className={isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"}>
              Sign In
            </Link>
            <Link href="/f/gF2yP8qSsRy0TiBKDK87f85a" className={isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"}>
              Public Form Demo
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}