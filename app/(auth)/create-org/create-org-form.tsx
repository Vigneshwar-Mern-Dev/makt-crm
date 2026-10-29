"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrganizationAction } from "@/app/lib/org-actions";

export function CreateOrgForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManual) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("slug", slug);

    startTransition(async () => {
      const res = await createOrganizationAction(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        router.push("/admin");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="org-name">
          Organization Name
        </label>
        <div className="mt-2">
          <input
            id="org-name"
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Apex Global Solutions"
            className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-neutral-600 transition focus:border-cyan-500 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">Your company, agency, or department name.</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="org-slug">
            Organization Slug (URL Identifier)
          </label>
          <span className="text-[11px] text-neutral-500 font-mono">Auto-generated</span>
        </div>
        <div className="mt-2 flex rounded-xl border border-white/[0.1] bg-white/[0.04] overflow-hidden focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
          <span className="flex select-none items-center px-3.5 text-xs text-neutral-500 border-r border-white/[0.06] bg-white/[0.02] font-mono">
            crm/org/
          </span>
          <input
            id="org-slug"
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setIsSlugManual(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            placeholder="apex-global"
            className="w-full bg-transparent px-3.5 py-3.5 text-sm text-white placeholder-neutral-600 focus:outline-none font-mono"
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">Unique identifier for your multi-tenant workspace.</p>
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/20 text-cyan-300 shrink-0 text-xs font-bold">
            ✓
          </div>
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-white">What happens next?</p>
            <p className="text-slate-400 leading-relaxed">
              You will be assigned as <span className="text-cyan-300 font-medium">Organization Owner</span>. You can then invite your agents and administrators or add them manually with one click.
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Creating Organization Workspace...
          </>
        ) : (
          "Launch Organization Workspace →"
        )}
      </button>
    </form>
  );
}
