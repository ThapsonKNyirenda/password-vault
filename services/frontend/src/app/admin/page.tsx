"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "../../components/Sidebar";
import { ConfirmDialog, type ConfirmDialogField } from "../../components/ConfirmDialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
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
    { id: "requests", label: "Approvals", icon: <IconInbox className="sidebar-link-icon" /> },
    { id: "inventory", label: "Inventory", icon: <IconServer className="sidebar-link-icon" /> },
    { id: "users", label: "Users", icon: <IconUser className="sidebar-link-icon" /> },
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
            description: `Authorizing access for request ${request.id.slice(0, 8)}.`,
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
            description: `Revoking request ${request.id.slice(0, 8)}.`,
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

    function openEditUserDialog(user: User): void {
        if (!session) return;
        setDialog({
            title: "Edit User",
            description: `Updating user ${user.username}.`,
            confirmLabel: "Save Changes",
            fields: [
                { name: "role", label: "Role", type: "select", defaultValue: user.role, options: roleOptions },
                { name: "active", label: "Status", type: "select", defaultValue: user.active ? "active" : "inactive", options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] }
            ],
            onConfirm: async (values) => {
                try {
                    const payload: UserUpdatePayload = {
                        role: values.role as UserRole,
                        active: values.active === "active"
                    };
                    await apiRequest(`/admin/users/${user.id}`, {
                        method: "PATCH", token: session.token, body: JSON.stringify(payload)
                    });
                    setMessage("User updated"); setMessageType("success");
                    await loadUsers();
                    return true;
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed to update user");
                    setMessageType("error"); return false;
                }
            }
        });
    }

    function openDeleteUserDialog(user: User): void {
        if (!session) return;
        setDialog({
            title: "Delete User",
            description: `Permanently deleting user ${user.username}. This action cannot be undone.`,
            confirmLabel: "Delete User", tone: "danger",
            onConfirm: async () => {
                try {
                    await apiRequest(`/admin/users/${user.id}`, { method: "DELETE", token: session.token });
                    setMessage("User deleted"); setMessageType("success");
                    await loadUsers();
                    return true;
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed to delete user");
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
                                <Button key={t.id} variant={activeTab === t.id ? "default" : "ghost"} onClick={() => setActiveTab(t.id)}>{t.label}</Button>
                            ))}
                        </div>

                        {activeTab === "requests" && (
                            <div className="table-wrap">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Requester</TableHead>
                                            <TableHead>Credential</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingRequests.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                    No pending requests.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            pendingRequests.map(r => (
                                                <TableRow key={r.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <IconUser className="w-4 h-4 text-muted-foreground" />
                                                            <strong>{r.requester_id}</strong>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{r.credential_id.slice(0, 16)}...</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{r.reason}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Button size="sm" onClick={() => openApproveDialog(r)}>
                                                                <IconShield className="w-4 h-4 mr-2" /> Approve
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => openDenyDialog(r)}>
                                                                <IconTrash className="w-4 h-4 mr-2" /> Deny
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {activeTab === "inventory" && (
                            <CardContent>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <CardTitle className="text-base font-medium">Credentials</CardTitle>
                                            <Button variant="ghost" size="sm" onClick={loadInventory}>
                                                <IconRefresh className="w-4 h-4" />
                                            </Button>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Target</TableHead>
                                                        <TableHead>Account</TableHead>
                                                        <TableHead>Sync</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {credentials.map(c => (
                                                        <TableRow key={c.id}>
                                                            <TableCell>{servers.find(s => s.id === c.server_id)?.name ?? c.server_id}</TableCell>
                                                            <TableCell className="font-medium">{c.managed_account}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary">{c.last_sync_source}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => openRevealDialog(c)}>
                                                                    <IconEye className="w-4 h-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base font-medium">Reveal Output</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {revealData ? (
                                                <div className="space-y-4">
                                                    <pre className="p-4 bg-muted rounded-md text-sm text-muted-foreground">{revealPayload}</pre>
                                                    <div className="flex items-center justify-between text-sm">
                                                        <Badge variant="outline">{revealData.credential_id.slice(0, 16)}...</Badge>
                                                        <span className="text-muted-foreground">Revealed {formatDate(revealTimestamp!)}</span>
                                                        <Button variant="ghost" size="sm" onClick={() => setRevealData(null)}>Clear</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-md">
                                                    <p className="text-muted-foreground">No reveal active.</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </CardContent>
                        )}

                        {activeTab === "users" && (
                            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Add User</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <form className="space-y-4" onSubmit={handleCreateUser}>
                                            <div className="space-y-2">
                                                <label htmlFor="username">Username</label>
                                                <Input id="username" name="username" required />
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="password">Password</label>
                                                <Input id="password" name="password" type="password" minLength={12} required />
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="role">Role</label>
                                                <Select name="role" defaultValue="engineer">
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {roleOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button type="submit" className="w-full">
                                                <IconUser className="w-4 h-4 mr-2" /> Create User
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Active Directory</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>User</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {users.map(u => (
                                                    <TableRow key={u.id}>
                                                        <TableCell className="font-medium">{u.username}</TableCell>
                                                        <TableCell className="capitalize">{u.role}</TableCell>
                                                        <TableCell>
                                                            <StatusBadge status={u.active ? "active" : "inactive"} />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => openEditUserDialog(u)} disabled={u.id === session.id}>
                                                                <IconEdit className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => openDeleteUserDialog(u)} disabled={u.id === session.id}>
                                                                <IconTrash className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        )}
                    </div>
                    {message && <div className={`toast ${messageType}`} style={{ marginTop: "1rem" }}>{message}</div>}
                </div>
            </main>
            <ConfirmDialog open={Boolean(dialog)} title={dialog?.title ?? ""} description={dialog?.description} confirmLabel={dialog?.confirmLabel} tone={dialog?.tone} fields={dialog?.fields} busy={dialogBusy} onConfirm={handleDialogConfirm} onClose={() => setDialog(null)} />
        </div>
    );
}
