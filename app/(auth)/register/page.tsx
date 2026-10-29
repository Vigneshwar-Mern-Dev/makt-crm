import Link from "next/link";
import { registerAction } from "@/app/lib/auth-actions";
import { AuthSubmitButton } from "../components/auth-submit-button";
import { PasswordField } from "../components/password-field";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
    invite?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error, invite } = await searchParams;

  return (
    <main className="min-h-screen bg-[#03090e] font-sans text-neutral-100 antialiased selection:bg-cyan-500 selection:text-black">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* Left Side: Brand Showcase & Multi-Tenant SaaS Highlights */}
        <section className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-white/[0.04] p-16">
          {/* Animated Glow Elements */}
          <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[130px]" />
          <div className="absolute bottom-[-10%] right-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
          
          {/* Grid Backdrop Layer */}
          <div 
            className="absolute inset-0 opacity-[0.25] bg-[linear-gradient(to_right,#0e222b_1px,transparent_1px),linear-gradient(to_bottom,#0e222b_1px,transparent_1px)] bg-[size:40px_40px]" 
            style={{ maskImage: "radial-gradient(ellipse at center, black 60%, transparent 100%)" }}
          />

          <Link href="/" className="relative z-10 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="bg-gradient-to-r from-neutral-200 to-neutral-400 bg-clip-text text-xs font-black uppercase tracking-[0.3em] text-transparent">
              MAKT SaaS
            </span>
          </Link>

          {/* Main Visual Statement */}
          <div className="relative z-10 max-w-xl my-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-medium text-cyan-300 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              Multi-Tenant Architecture
            </div>

            <h1 className="text-5xl font-black tracking-tight leading-[1.1] text-white xl:text-6xl">
              Launch your <br />
              <span className="bg-gradient-to-r from-cyan-400 via-teal-200 to-white bg-clip-text text-transparent">
                Organization in seconds.
              </span>
            </h1>
            <p className="mt-6 text-base text-neutral-400 leading-relaxed font-light">
              Create your company workspace, invite team members with granular role controls, and scale your call operations with zero cross-tenant contamination.
            </p>

            {/* Workflow steps */}
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { step: "01", title: "Create Org", desc: "Custom URL & workspace", glow: "text-cyan-400" },
                { step: "02", title: "Invite Team", desc: "Email link or manual add", glow: "text-teal-400" },
                { step: "03", title: "Operate", desc: "Isolated leads & calls", glow: "text-emerald-400" },
              ].map((item, i) => (
                <div key={i} className="group relative rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
                  <span className={`text-xs font-mono font-bold ${item.glow}`}>{item.step}</span>
                  <p className="mt-2 text-sm font-semibold text-neutral-200">{item.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-xs text-neutral-600 font-mono">
            Enterprise multi-tenant isolation enabled
          </div>
        </section>

        {/* Right Side: Signup Form */}
        <section className="relative flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16 bg-[#040b10]">
          <div className="absolute inset-0 block lg:hidden opacity-30 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.08),transparent_70%)]" />

          <div className="relative w-full max-w-md">
            
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/50 px-3 py-1 text-xs font-medium text-neutral-400">
                {invite ? "Organization Invitation" : "Get Started"}
              </div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
                {invite ? "Join Organization" : "Create Account"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {invite
                  ? "Create your account to accept the invitation and access your team workspace."
                  : "Sign up to set up your organization workspace and invite your team."}
              </p>
            </div>

            {/* Error Banner */}
            {error ? (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            {/* Form */}
            <form action={registerAction} className="space-y-4">
              {invite ? (
                <input type="hidden" name="inviteToken" value={invite} />
              ) : null}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="username">
                  Username
                </label>
                <div className="relative mt-2">
                  <input
                    autoComplete="username"
                    autoFocus
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder-neutral-600 transition-all duration-200 focus:border-cyan-500 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    id="username"
                    name="username"
                    placeholder="e.g. alex.chen"
                    required
                    type="text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="email">
                  Work Email
                </label>
                <div className="relative mt-2">
                  <input
                    autoComplete="email"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder-neutral-600 transition-all duration-200 focus:border-cyan-500 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    id="email"
                    name="email"
                    placeholder="you@company.com"
                    required
                    type="email"
                  />
                </div>
              </div>

              <div>
                <PasswordField
                  autoComplete="new-password"
                  minLength={12}
                />
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  Must be at least 12 characters with a mix of characters.
                </p>
              </div>

              <div className="pt-2">
                <AuthSubmitButton
                  idleText={invite ? "Accept & Join Organization" : "Create Account & Continue →"}
                  pendingText="Setting up account..."
                />
              </div>
            </form>

            {/* Switch to login */}
            <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
              <p className="text-sm text-slate-400">
                Already have an account?{" "}
                <Link
                  className="font-semibold text-cyan-400 transition hover:text-cyan-300"
                  href={invite ? `/login?redirect=/invite/${invite}` : "/login"}
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
