import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { readSession } from "@/app/lib/session";
import { logoutAction } from "@/app/lib/auth-actions";
import { CreateOrgForm } from "./create-org-form";

export default async function CreateOrgPage() {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, email: true, organizationId: true },
  });

  if (!user) {
    redirect("/login");
  }

  // If user already has an organization, no need to be here
  if (user.organizationId) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-[#03090e] font-sans text-neutral-100 antialiased selection:bg-cyan-500 selection:text-black flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full bg-teal-500/10 blur-[130px] pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto pb-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="bg-gradient-to-r from-neutral-200 to-neutral-400 bg-clip-text text-xs font-black uppercase tracking-[0.3em] text-transparent">
            MAKT SaaS
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">Signed in as <strong className="text-white">{user.email}</strong></span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-xl mx-auto my-auto">
        <div className="rounded-2xl border border-white/[0.08] bg-[#061017]/90 p-8 sm:p-10 backdrop-blur-xl shadow-2xl shadow-cyan-950/30">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-medium text-cyan-300 mb-4">
              Step 1 of 1: Setup Workspace
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Create your Organization
            </h1>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Every organization in MAKT CRM has completely isolated CRM data, leads, phone integrations, and role-based permissions.
            </p>
          </div>

          <CreateOrgForm />
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto pt-6 text-center text-xs text-neutral-600 font-mono">
        Secured with Multi-Tenant PostgreSQL Data Isolation
      </footer>
    </main>
  );
}
