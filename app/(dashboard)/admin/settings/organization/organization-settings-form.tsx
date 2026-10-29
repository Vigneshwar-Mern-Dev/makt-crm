"use client";

import { useState, useTransition } from "react";
import { updateOrganizationAction } from "@/app/lib/org-actions";

type OrganizationSettingsFormProps = {
  initialName: string;
  initialSlug: string;
  initialLogo: string | null;
  canEdit: boolean;
};

export function OrganizationSettingsForm({
  initialName,
  initialSlug,
  initialLogo,
  canEdit,
}: OrganizationSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [logo, setLogo] = useState(initialLogo || "");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      const res = await updateOrganizationAction({
        name,
        slug,
        logo: logo.trim() || undefined,
      });

      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage("Organization settings updated successfully!");
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {successMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <p>{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="org-name">
            Organization Name
          </label>
          <input
            id="org-name"
            type="text"
            required
            disabled={!canEdit || isPending}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-neutral-500">The displayed name across the CRM dashboard.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="org-slug">
            Organization Slug (URL Identifier)
          </label>
          <input
            id="org-slug"
            type="text"
            required
            disabled={!canEdit || isPending}
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white font-mono transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-neutral-500">Unique slug identifier for your tenant workspace.</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="org-logo">
          Logo URL (Optional)
        </label>
        <input
          id="org-logo"
          type="url"
          disabled={!canEdit || isPending}
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-neutral-500">Public image URL for your company logo.</p>
      </div>

      {canEdit ? (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      ) : (
        <p className="text-xs text-amber-300">Only organization Owners and Admins can modify organization settings.</p>
      )}
    </form>
  );
}
