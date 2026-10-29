import Link from "next/link";
import { db } from "@/app/lib/db";
import { readSession } from "@/app/lib/session";
import { getInvitationByToken } from "@/app/lib/org-actions";
import { InviteAcceptCard } from "./invite-accept-card";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  const session = await readSession();
  let currentUser = null;
  if (session) {
    currentUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, organizationId: true },
    });
  }

  return (
    <main className="min-h-screen bg-[#03090e] font-sans text-neutral-100 antialiased selection:bg-cyan-500 selection:text-black flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto pb-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="bg-gradient-to-r from-neutral-200 to-neutral-400 bg-clip-text text-xs font-black uppercase tracking-[0.3em] text-transparent">
            MAKT SaaS
          </span>
        </Link>

        {currentUser ? (
          <span className="text-xs text-neutral-400">
            Signed in as <strong className="text-white">{currentUser.email}</strong>
          </span>
        ) : (
          <Link
            href={`/login?redirect=/invite/${token}`}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Sign in
          </Link>
        )}
      </header>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-lg mx-auto my-auto">
        {!invitation || !invitation.isValid ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#061017]/90 p-8 sm:p-10 backdrop-blur-xl text-center shadow-2xl shadow-red-950/20">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white">Invitation Expired or Invalid</h1>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              This organization invitation link has expired, been revoked, or is no longer valid. Please contact your organization administrator to receive a fresh invite link.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Go to Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110"
              >
                Create New Organization
              </Link>
            </div>
          </div>
        ) : (
          <InviteAcceptCard
            token={token}
            email={invitation.email}
            role={invitation.role}
            orgName={invitation.organization.name}
            orgSlug={invitation.organization.slug}
            isLoggedIn={Boolean(currentUser)}
            currentUserEmail={currentUser?.email}
            userAlreadyInOtherOrg={Boolean(
              currentUser?.organizationId &&
              currentUser.organizationId !== invitation.organization.id
            )}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto pt-6 text-center text-xs text-neutral-600 font-mono">
        Secured with Multi-Tenant PostgreSQL Data Isolation
      </footer>
    </main>
  );
}
