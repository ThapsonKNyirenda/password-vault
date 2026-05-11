"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "../../components/Sidebar";
import { ConfirmDialog, type ConfirmDialogField } from "../../components/ConfirmDialog";
import { 
    IconAlert, IconEdit, IconEye, IconRefresh, IconRestore, 
    IconTrash, IconUser, IconShield, IconKey, IconLock, IconInbox,
    IconServer, IconCheckCircle, IconExclamation
} from "../../components/Icons";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { getSession } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import type {
    AccessRequest,
    Agent,
    AgentCreateResponse,
    Credential,
    RevealCredentialResponse,
    TargetServer,
    User,
    UserRole,
    UserUpdatePayload,
} from "../../lib/types";

interface DialogState {
    title: string;
    description?: string;
    confirmLabel?: string;
    tone?: "default" | "danger";
    fields?: ConfirmDialogField[];
    onConfirm: (values: Record<string, string>) => Promise<boolean | void>;
}

const roleOptions: Array<{ label: string; value: UserRole }> = [
    { label: "Admin", value: "admin" },
    { label: "Engineer", value: "engineer" },
];

const TABS = [
    { id: "requests",  label: "Approvals",   icon: <IconInbox className="sidebar-link-icon" /> },
    { id: "inventory", label: "Inventory",   icon: <IconServer className="sidebar-link-icon" /> },
    { id: "users",     label: "Users",       icon: <IconUser className="sidebar-link-icon" /> },
];

export default function AdminPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);

    const [activeTab, setActiveTab] = useState("requests");
    const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [servers, setServers] = useState<TargetServer[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<"" | "error" | "success">("");
    const [revealData, setRevealData] = useState<RevealCredentialResponse | null>(null);
    const [revealTimestamp, setRevealTimestamp] = useState<string | null>(null);
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [dialogBusy, setDialogBusy] = useState(false);
    const [validation, setValidation] = useState<Record<string, boolean>>({});

    const loadPendingRequests = useCallback(async (): Promise<void> => {
        if (!session) return;
        try {
            const data = await apiRequest<AccessRequest[]>("/access-requests/pending", { token: session.token });
            setPendingRequests(data);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load requests");
            setMessageType("error");
        }
    }, [session]);

    const loadInventory = useCallback(async (): Promise<void> => {
        if (!session) return;
        try {
            const [agentList, serverList, credentialList] = await Promise.all([
                apiRequest<Agent[]>("/admin/agents", { token: session.token }),
                apiRequest<TargetServer[]>("/admin/servers", { token: session.token }),
                apiRequest<Credential[]>("/admin/credentials", { token: session.token }),
            ]);
            setAgents(agentList);
            setServers(serverList);
            setCredentials(credentialList);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load inventory");
            setMessageType("error");
        }
    }, [session]);

    const loadUsers = useCallback(async (): Promise<void> => {
        if (!session) return;
        try {
            const data = await apiRequest<User[]>("/admin/users?include_inactive=true", { token: session.token });
            setUsers(data);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load users");
            setMessageType("error");
        }
    }, [session]);

    useEffect(() => {
        if (!session) { router.replace("/login"); return; }
        if (session.role !== "admin") { router.replace("/engineer"); return; }
        void Promise.all([loadPendingRequests(), loadInventory(), loadUsers()]);
    }, [loadInventory, loadPendingRequests, loadUsers, router, session]);

    const stats = useMemo(() => ({
        pending: pendingRequests.length,
        credentials: credentials.length,
        agents: agents.filter(a => a.active).length,
        users: users.filter(u => u.active).length
    }), [pendingRequests, credentials, agents, users]);

    async function handleDialogConfirm(values: Record<string, string>): Promise<void> {
        if (!dialog) return;
        setDialogBusy(true);
        try {
            const ok = await dialog.onConfirm(values);
            if (ok !== false) setDialog(null);
        } finally { setDialogBusy(false); }
    }

    // --- Actions ---

    function openApproveDialog(request: AccessRequest): void {
        if (!session) return;
        setDialog({
            title: "Approve Access",
            description: `Authorizing access for request ${request.id.slice(0,8)}.`,
            confirmLabel: "Approve",
            fields: [{
                name: "expires_minutes", label: "Validity (minutes)", type: "number",
                defaultValue: "15", min: 5, max: 120, helper: "Max 120 minutes."
            }],
            onConfirm: async (values) => {
                try {
                    await apiRequest(`/access-requests/${request.id}/approve`, {
                        method: "POST", token: session.token,
                        body: JSON.stringify({ expires_minutes: Number(values.expires_minutes) })
                    });
                    setMessage("Request approved"); setMessageType("success");
                    await loadPendingRequests();
                    return true;
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed to approve");
                    setMessageType("error"); return false;
                }
            }
        });
    }

    function openDenyDialog(request: AccessRequest): void {
        if (!session) return;
        setDialog({
            title: "Deny Access",
            description: `Revoking request ${request.id.slice(0,8)}.`,
            confirmLabel: "Deny", tone: "danger",
            fields: [{ name: "note", label: "Reason", type: "textarea", placeholder: "Unauthorized" }],
            onConfirm: async (values) => {
                try {
                    await apiRequest(`/access-requests/${request.id}/deny`, {
                        method: "POST", token: session.token, body: JSON.stringify({ note: values.note })
                    });
                    setMessage("Request denied"); setMessageType("success");
                    await loadPendingRequests();
                    return true;
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed to deny");
                    setMessageType("error"); return false;
                }
            }
        });
    }

    function openRevealDialog(credential: Credential, serverName?: string): void {
        if (!session) return;
        setDialog({
            title: "Emergency Reveal",
            description: `Decrypting password for ${credential.managed_account} on ${serverName ?? credential.server_id}. This action is audited.`,
            confirmLabel: "Reveal Password", tone: "danger",
            onConfirm: async () => {
                try {
                    const data = await apiRequest<RevealCredentialResponse>(`/admin/credentials/${credential.id}/reveal`, { token: session.token });
                    setRevealData(data); setRevealTimestamp(new Date().toISOString());
                    setMessage("Password revealed and audited."); setMessageType("success");
                    return true;
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed to reveal");
                    setMessageType("error"); return false;
                }
            }
        });
    }

    // --- Form Handlers (Simplified for brevity) ---

    async function handleCreateUser(e: FormEvent<HTMLFormElement>) {
        e.preventDefault(); if (!session) return;
        const fd = new FormData(e.currentTarget);
        try {
            await apiRequest("/admin/users", {
                method: "POST", token: session.token,
                body: JSON.stringify(Object.fromEntries(fd))
            });
            setMessage("User created"); setMessageType("success");
            e.currentTarget.reset(); await loadUsers();
        } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); setMessageType("error"); }
    }

    if (!session) return <div className="layout" />;

    const revealPayload = revealData ? `server=${revealData.server_name}\nmanaged_account=${revealData.managed_account}\npassword=${revealData.password}` : "";

    return (
        <div className="layout">
            <Sidebar username={session.username} role={session.role} activeTab={activeTab} tabs={TABS} onTabChange={setActiveTab} />
            <main className="main-content">
                <div className="page-shell">
                    <header className="page-header">
                        <h1 className="page-title">Administrative Control</h1>
                        <p className="page-subtitle">Manage system access, inventory, and users.</p>
                    </header>

                    <div className="stats-grid">
                        <StatCard 
                            label="Pending Approvals" 
                            value={stats.pending}
                            variant={stats.pending > 0 ? "warning" : "success"}
                            icon={<IconExclamation className="icon-lg" />}
                        />
                        <StatCard 
                            label="Managed Credentials" 
                            value={stats.credentials}
                            variant="accent"
                            icon={<IconKey className="icon-lg" />}
                        />
                        <StatCard 
                            label="Active Agents" 
                            value={stats.agents}
                            variant="success"
                            icon={<IconCheckCircle className="icon-lg" />}
                        />
                        <StatCard 
                            label="Total Users" 
                            value={stats.users}
                            icon={<IconUser className="icon-lg" />}
                        />
                    </div>

                    <div className="card">
                        <div className="tabs">
                            {TABS.map(t => (
                                <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
                            ))}
                        </div>

                        {activeTab === "requests" && (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Requester</th><th>Credential</th><th>Reason</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {pendingRequests.length === 0 ? <tr className="empty-row"><td colSpan={4}>No pending requests.</td></tr> :
                                        pendingRequests.map(r => (
                                            <tr key={r.id}>
                                                <td><div className="flex-row"><IconUser className="icon-sm" /> <strong>{r.requester_id}</strong></div></td>
                                                <td><span className="mono-tag">{r.credential_id}</span></td>
                                                <td style={{ color: "var(--text-muted)" }}>{r.reason}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="btn-primary btn-sm" onClick={() => openApproveDialog(r)}><IconShield className="icon-sm" /> Approve</button>
                                                        <button className="btn-danger btn-sm" onClick={() => openDenyDialog(r)}><IconTrash className="icon-sm" /> Deny</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === "inventory" && (
                            <div className="card-body">
                                <div className="grid-2">
                                    <article>
                                        <div className="flex-between" style={{ marginBottom: "1rem" }}>
                                            <h3 className="card-title">Credentials</h3>
                                            <button className="btn btn-ghost btn-sm" onClick={loadInventory}><IconRefresh className="icon-sm" /></button>
                                        </div>
                                        <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: "8px" }}>
                                            <table>
                                                <thead><tr><th>Target</th><th>Account</th><th>Sync</th><th>Actions</th></tr></thead>
                                                <tbody>
                                                    {credentials.map(c => (
                                                        <tr key={c.id}>
                                                            <td>{servers.find(s => s.id === c.server_id)?.name ?? c.server_id}</td>
                                                            <td><strong>{c.managed_account}</strong></td>
                                                            <td><span className="badge badge-info">{c.last_sync_source}</span></td>
                                                            <td><button className="btn btn-ghost btn-sm" onClick={() => openRevealDialog(c)}><IconEye className="icon-sm" /></button></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </article>
                                    <article>
                                        <h3 className="card-title" style={{ marginBottom: "1rem" }}>Reveal Output</h3>
                                        {revealData ? (
                                            <div className="section-gap">
                                                <pre className="secret">{revealPayload}</pre>
                                                <div className="secret-meta">
                                                    <span className="mono-tag">{revealData.credential_id}</span>
                                                    <span>Revealed {formatDate(revealTimestamp!)}</span>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setRevealData(null)}>Clear</button>
                                                </div>
                                            </div>
                                        ) : <div className="toast" style={{ justifyContent: "center", padding: "3rem" }}>No reveal active.</div>}
                                    </article>
                                </div>
                            </div>
                        )}

                        {activeTab === "users" && (
                            <div className="card-body grid-2">
                                <form className="form-stack" onSubmit={handleCreateUser}>
                                    <h3 className="card-title">Add User</h3>
                                    <label>Username <input name="username" required /></label>
                                    <label>Password <input name="password" type="password" minLength={12} required /></label>
                                    <label>Role 
                                        <select name="role" defaultValue="engineer">
                                            {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </label>
                                    <button className="btn-primary" type="submit"><IconUser className="icon-sm" /> Create User</button>
                                </form>
                                <div className="table-wrap">
                                    <h3 className="card-title" style={{ marginBottom: "1rem" }}>Active Directory</h3>
                                    <table>
                                        <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td><strong>{u.username}</strong></td>
                                                    <td>{u.role}</td>
                                                    <td><StatusBadge status={u.active ? "active" : "inactive"} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                    {message && <div className={`toast ${messageType}`} style={{ marginTop: "1rem" }}>{message}</div>}
                </div>
            </main>
            <ConfirmDialog open={Boolean(dialog)} title={dialog?.title ?? ""} description={dialog?.description} confirmLabel={dialog?.confirmLabel} tone={dialog?.tone} fields={dialog?.fields} busy={dialogBusy} onConfirm={handleDialogConfirm} onClose={() => setDialog(null)} />
        </div>
    );
}
