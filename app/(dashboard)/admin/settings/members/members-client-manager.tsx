"use client";

import { useState, useTransition } from "react";
import {
  inviteMemberAction,
  revokeInvitationAction,
  createMemberManuallyAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/app/lib/org-actions";

type Member = {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    department: string;
    isActive: boolean;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

type MembersClientManagerProps = {
  members: Member[];
  invitations: Invitation[];
  currentUserId: string;
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  orgName: string;
  baseUrl: string;
};

export function MembersClientManager({
  members,
  invitations,
  currentUserId,
  currentUserRole,
  orgName,
  baseUrl,
}: MembersClientManagerProps) {
  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Invite modal form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Manual creation modal form state
  const [manualUsername, setManualUsername] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [manualDepartment, setManualDepartment] = useState("Telecalling");
  const [manualRole, setManualRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [manualSuccessDetails, setManualSuccessDetails] = useState<{
    username: string;
    email: string;
    password: string;
  } | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Action transitions
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Helper to generate a random 14-char password
  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setManualPassword(pass);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setGeneratedInviteLink(null);

    startTransition(async () => {
      const res = await inviteMemberAction({
        email: inviteEmail,
        role: inviteRole,
      });

      if (res.error) {
        setInviteError(res.error);
      } else if (res.token) {
        const link = `${baseUrl}/invite/${res.token}`;
        setGeneratedInviteLink(link);
      }
    });
  };

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleManualCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    startTransition(async () => {
      const res = await createMemberManuallyAction({
        username: manualUsername,
        email: manualEmail,
        password: manualPassword,
        department: manualDepartment,
        role: manualRole,
      });

      if (res.error) {
        setManualError(res.error);
      } else {
        setManualSuccessDetails({
          username: manualUsername,
          email: manualEmail,
          password: manualPassword,
        });
        // reset form inputs
        setManualUsername("");
        setManualEmail("");
        setManualPassword("");
      }
    });
  };

  const handleRevokeInvite = (invitationId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    setActionError(null);

    startTransition(async () => {
      const res = await revokeInvitationAction(invitationId);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess("Invitation revoked successfully.");
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  const handleRoleChange = (memberId: string, newRole: "ADMIN" | "MEMBER" | "OWNER") => {
    setActionError(null);
    startTransition(async () => {
      const res = await updateMemberRoleAction({ memberId, newRole });
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess("Member role updated successfully.");
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  const handleRemoveMember = (memberId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from ${orgName}? Their access will be revoked immediately.`)) return;
    setActionError(null);

    startTransition(async () => {
      const res = await removeMemberAction(memberId);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(`Member removed from ${orgName}.`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {actionSuccess ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <p>{actionSuccess}</p>
        </div>
      ) : null}

      {actionError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
          <p>{actionError}</p>
        </div>
      ) : null}

      {/* Action Bar & Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tab switchers */}
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            onClick={() => setActiveTab("members")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "members"
                ? "bg-cyan-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Active Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("invitations")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "invitations"
                ? "bg-cyan-400 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Pending Invites ({invitations.length})
            {invitations.length > 0 && (
              <span className={`h-2 w-2 rounded-full ${activeTab === "invitations" ? "bg-slate-950" : "bg-cyan-400 animate-pulse"}`} />
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setInviteEmail("");
              setGeneratedInviteLink(null);
              setInviteError(null);
              setShowInviteModal(true);
            }}
            className="flex-1 sm:flex-none rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20 flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            Invite via Link
          </button>

          <button
            onClick={() => {
              setManualSuccessDetails(null);
              setManualError(null);
              generateRandomPassword();
              setShowManualModal(true);
            }}
            className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Member Manually
          </button>
        </div>
      </div>

      {/* Tab Content: Active Members */}
      {activeTab === "members" && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Joined Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {members.map((m) => {
                  const isSelf = m.user.id === currentUserId;
                  const canManageRole =
                    currentUserRole === "OWNER" ||
                    (currentUserRole === "ADMIN" && m.role === "MEMBER");
                  const canRemove =
                    !isSelf &&
                    m.role !== "OWNER" &&
                    (currentUserRole === "OWNER" || (currentUserRole === "ADMIN" && m.role === "MEMBER"));

                  return (
                    <tr key={m.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/10 text-xs font-bold text-white">
                            {m.user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{m.user.username}</span>
                              {isSelf && (
                                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">{m.user.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-300 font-medium">
                        {m.user.department || "Operations"}
                      </td>

                      <td className="px-5 py-4">
                        {canManageRole && !isSelf ? (
                          <select
                            value={m.role}
                            disabled={isPending}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as "ADMIN" | "MEMBER" | "OWNER")}
                            className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="MEMBER">MEMBER (Agent)</option>
                            <option value="ADMIN">ADMIN</option>
                            {currentUserRole === "OWNER" && (
                              <option value="OWNER">OWNER</option>
                            )}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                              m.role === "OWNER"
                                ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : m.role === "ADMIN"
                                ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                : "border border-teal-500/30 bg-teal-500/10 text-teal-300"
                            }`}
                          >
                            {m.role}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                        {new Date(m.joinedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {canRemove ? (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.user.username)}
                            disabled={isPending}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Pending Invitations */}
      {activeTab === "invitations" && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          {invitations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">No pending invitations</h3>
              <p className="mt-1 text-xs text-slate-400">
                Click &ldquo;Invite via Link&rdquo; to send an invite link to new team members.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Invited Email</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Expires</th>
                    <th className="px-5 py-3.5">Invite Link</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {invitations.map((inv) => {
                    const link = `${baseUrl}/invite/${inv.token}`;
                    return (
                      <tr key={inv.id} className="transition hover:bg-white/[0.02]">
                        <td className="px-5 py-4">
                          <span className="font-semibold text-white">{inv.email}</span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                            {inv.role}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                          {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(link);
                              setActionSuccess(`Copied invite link for ${inv.email}`);
                              setTimeout(() => setActionSuccess(null), 3000);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
                          >
                            <svg className="h-3.5 w-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                            Copy Link
                          </button>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            disabled={isPending}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Invite via Link / Email */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#070e14] p-6 sm:p-8 shadow-2xl shadow-cyan-950/40">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Invite Team Member</p>
            </div>
            <h2 className="text-xl font-bold text-white">Generate Invitation Link</h2>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Send an invitation to join <strong className="text-white">{orgName}</strong>. The recipient can create their account or sign in directly.
            </p>

            {inviteError ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                {inviteError}
              </div>
            ) : null}

            {generatedInviteLink ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Invitation Link Ready (Valid 7 days)
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 p-2 font-mono text-xs text-cyan-200 break-all select-all">
                    {generatedInviteLink}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(generatedInviteLink, setCopiedLink)}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {copiedLink ? (
                    <>
                      ✓ Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                      Copy Invitation Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGeneratedInviteLink(null);
                    setInviteEmail("");
                  }}
                  className="w-full text-center text-xs text-slate-400 hover:text-white transition py-1"
                >
                  Invite another teammate
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="inv-email">
                    Teammate Work Email
                  </label>
                  <input
                    id="inv-email"
                    type="email"
                    required
                    autoFocus
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-neutral-600 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="inv-role">
                    Role in Organization
                  </label>
                  <select
                    id="inv-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "MEMBER" | "ADMIN")}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b141d] px-4 py-3 text-sm text-white transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="MEMBER">MEMBER (Telecaller / Agent portal)</option>
                    <option value="ADMIN">ADMIN (Full management access)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3.5 text-sm font-bold text-slate-950 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending ? "Generating..." : "Generate & Copy Invite Link →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Add Member Manually */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#070e14] p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowManualModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Direct Provisioning</p>
            </div>
            <h2 className="text-xl font-bold text-white">Add Member Manually</h2>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Create an account immediately for your team member in <strong className="text-white">{orgName}</strong>. They won&apos;t need to wait for an invite email.
            </p>

            {manualError ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                {manualError}
              </div>
            ) : null}

            {manualSuccessDetails ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Member Created Successfully!
                  </div>
                  <p className="text-xs text-slate-300">
                    Share these login credentials directly with the team member:
                  </p>

                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/60 p-3.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Username:</span>
                      <span className="text-white font-bold">{manualSuccessDetails.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="text-white font-bold">{manualSuccessDetails.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Password:</span>
                      <span className="text-cyan-300 font-bold">{manualSuccessDetails.password}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Login URL:</span>
                      <span className="text-slate-300 truncate max-w-[200px]">{baseUrl}/login</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const text = `Here are your login credentials for ${orgName}:\nURL: ${baseUrl}/login\nUsername: ${manualSuccessDetails.username}\nPassword: ${manualSuccessDetails.password}`;
                    handleCopy(text, setCopiedCredentials);
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110 flex items-center justify-center gap-2"
                >
                  {copiedCredentials ? "✓ Credentials Copied!" : "Copy Credentials Text"}
                </button>

                <button
                  type="button"
                  onClick={() => setManualSuccessDetails(null)}
                  className="w-full text-center text-xs text-slate-400 hover:text-white transition py-1"
                >
                  Add another team member
                </button>
              </div>
            ) : (
              <form onSubmit={handleManualCreate} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="man-user">
                      Username
                    </label>
                    <input
                      id="man-user"
                      type="text"
                      required
                      autoFocus
                      value={manualUsername}
                      onChange={(e) => setManualUsername(e.target.value)}
                      placeholder="e.g. priya.patel"
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 transition focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="man-email">
                      Work Email
                    </label>
                    <input
                      id="man-email"
                      type="email"
                      required
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="priya@company.com"
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 transition focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="man-pass">
                      Password (Min 12 chars)
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    id="man-pass"
                    type="text"
                    required
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-cyan-200 font-mono transition focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="man-dept">
                      Department
                    </label>
                    <input
                      id="man-dept"
                      type="text"
                      value={manualDepartment}
                      onChange={(e) => setManualDepartment(e.target.value)}
                      placeholder="e.g. Telecalling"
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 transition focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="man-role">
                      Assigned Role
                    </label>
                    <select
                      id="man-role"
                      value={manualRole}
                      onChange={(e) => setManualRole(e.target.value as "MEMBER" | "ADMIN")}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0b141d] px-3.5 py-2.5 text-sm text-white transition focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="MEMBER">MEMBER (Agent portal)</option>
                      <option value="ADMIN">ADMIN (Full management)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending ? "Creating Account..." : "Create Account & Add to Org →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
