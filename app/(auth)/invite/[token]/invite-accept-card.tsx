"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrgRole } from "@prisma/client";
import { acceptInvitationAction } from "@/app/lib/org-actions";
import { registerAction } from "@/app/lib/auth-actions";

type InviteAcceptCardProps = {
  token: string;
  email: string;
  role: OrgRole;
  orgName: string;
  orgSlug: string;
  isLoggedIn: boolean;
  currentUserEmail?: string;
  userAlreadyInOtherOrg?: boolean;
};

export function InviteAcceptCard({
  token,
  email,
  role,
  orgName,
  isLoggedIn,
  currentUserEmail,
  userAlreadyInOtherOrg,
}: InviteAcceptCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAcceptLoggedIn = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await acceptInvitationAction(token);
      if (res?.error) {
        setErrorMessage(res.error);
      } else if (res?.redirect) {
        router.push(res.redirect);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#061017]/90 p-8 sm:p-10 backdrop-blur-xl shadow-2xl shadow-cyan-950/30">
      {/* Org Invitation Header */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 mb-3">
          Organization Invitation
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Join <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">{orgName}</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          You have been invited to join as <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white uppercase text-xs">{role}</span>
        </p>
      </div>

      {errorMessage ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {/* Case 1: User is already logged in */}
      {isLoggedIn ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
            <p className="text-xs text-neutral-400">Currently signed in as</p>
            <p className="mt-1 font-semibold text-white">{currentUserEmail}</p>
          </div>

          {userAlreadyInOtherOrg ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
              <p className="font-semibold text-amber-100 mb-1">Different Organization Detected</p>
              Your account currently belongs to another organization. To accept this invitation, sign out and create or sign in with an account matching <strong className="text-white">{email}</strong>.
            </div>
          ) : (
            <button
              onClick={handleAcceptLoggedIn}
              disabled={isPending}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Accepting Invitation...
                </>
              ) : (
                `Accept Invitation & Enter ${orgName} →`
              )}
            </button>
          )}

          <div className="text-center pt-2">
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Sign in with a different account
            </Link>
          </div>
        </div>
      ) : (
        /* Case 2: New User - Registration form to claim invite */
        <div className="space-y-6">
          <form action={registerAction} className="space-y-4">
            <input type="hidden" name="inviteToken" value={token} />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="email">
                Invited Email
              </label>
              <div className="relative mt-2">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  readOnly
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-sm text-slate-400 cursor-not-allowed select-none font-mono"
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">This invitation is linked to this specific email address.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="username">
                Choose Username
              </label>
              <div className="relative mt-2">
                <input
                  type="text"
                  id="username"
                  name="username"
                  required
                  autoFocus
                  placeholder="e.g. your.name"
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-neutral-600 transition focus:border-cyan-500 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="password">
                Create Password
              </label>
              <div className="relative mt-2">
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  placeholder="At least 12 characters"
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder-neutral-600 transition focus:border-cyan-500 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">Minimum 12 characters.</p>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
            >
              Create Account & Join {orgName} →
            </button>
          </form>

          <div className="text-center pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-slate-400">
              Already have an account?{" "}
              <Link
                href={`/login?redirect=/invite/${token}`}
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                Sign in to join
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
