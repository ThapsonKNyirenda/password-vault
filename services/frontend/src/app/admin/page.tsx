"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "../../components/Sidebar";
import { HeaderActions } from "../../components/HeaderActions";
import { ConfirmDialog, type ConfirmDialogField } from "../../components/ConfirmDialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { SearchInput } from "../../components/SearchInput";
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
    IconEdit,
    IconEye,
    IconRefresh,
    IconTrash,
    IconUser,
    IconKey,
    IconInbox,
    IconServer,
    IconCheckCircle,
    IconExclamation,
    IconAlert,
    IconActivity,
} from "../../components/Icons";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../components/ToastProvider";
import { apiRequest } from "../../lib/api";
import { getSession } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import type {
    Agent,
    AgentUpdatePayload,
    Credential,
    CredentialSshStatusResponse,
    CredentialUpdatePayload,
    RevealCredentialResponse,
    TargetServer,
    TargetServerUpdatePayload,
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
    { id: "servers", label: "Servers", icon: <IconServer className="sidebar-link-icon" /> },
    { id: "agents", label: "Agents", icon: <IconInbox className="sidebar-link-icon" /> },
    { id: "credentials", label: "Credentials", icon: <IconKey className="sidebar-link-icon" /> },
    { id: "users", label: "Users", icon: <IconUser className="sidebar-link-icon" /> },
    { id: "logs", label: "System Logs", icon: <IconAlert className="sidebar-link-icon" /> },
];

function auditRequestDetails(log: { details?: Record<string, unknown> }): Record<string, unknown> {
    const request = log.details?.request;
    return request && typeof request === "object" && !Array.isArray(request)
        ? request as Record<string, unknown>
        : {};
}

function auditDetailEntries(details: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(details).filter(([key]) => key !== "request");
}

function formatAuditValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function auditActorLabel(log: { actor_type: string; actor_id: string }, users: User[], agents: Agent[]): string {
    if (log.actor_type === "user") {
        const user = users.find((item) => String(item.id) === String(log.actor_id));
        return user?.username ?? `Unknown user (${log.actor_id})`;
    }

    if (log.actor_type === "agent") {
        const agent = agents.find((item) => String(item.id) === String(log.actor_id));
        return agent?.name ?? `Unknown agent (${log.actor_id})`;
    }

    return log.actor_id;
}

export default function AdminPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState<string>("servers");
    const [agents, setAgents] = useState<Agent[]>([]);
    const [servers, setServers] = useState<TargetServer[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    const [revealData, setRevealData] = useState<RevealCredentialResponse | null>(null);
    const [revealTimestamp, setRevealTimestamp] = useState<string | null>(null);
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [dialogBusy, setDialogBusy] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
    const [sshStatuses, setSshStatuses] = useState<Record<string, CredentialSshStatusResponse>>({});
    const [checkingSshId, setCheckingSshId] = useState<string | null>(null);

    const loadAuditLogs = useCallback(async (): Promise<void> => {
        if (!session) return;
        try {
            const data = await apiRequest<any[]>("/audit/logs", { token: session.token });
            setAuditLogs(data);
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to load logs", "error");
        }
    }, [addToast, session]);

    const loadServers = useCallback(async (): Promise<void> => {
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
            addToast(error instanceof Error ? error.message : "Failed to load servers", "error");
        }
    }, [addToast, session]);

    const loadUsers = useCallback(async (): Promise<void> => {
        if (!session) return;
        try {
            const data = await apiRequest<User[]>("/admin/users?include_inactive=true", { token: session.token });
            setUsers(data);
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to load users", "error");
        }
    }, [addToast, session]);

    useEffect(() => {
        if (!session) { router.replace("/login"); return; }
        if (session.role !== "admin") { router.replace("/engineer"); return; }
        void Promise.all([loadServers(), loadUsers(), loadAuditLogs()]);
    }, [loadServers, loadUsers, loadAuditLogs, router, session]);

    const stats = useMemo(() => ({
        credentials: credentials.length,
        agents: agents.filter(a => a.active).length,
        users: users.filter(u => u.active).length,
        logs: auditLogs.length
    }), [credentials, agents, users, auditLogs]);

    const filteredAuditLogs = useMemo(() => {
        let filtered = auditLogs;
        if (!searchTerm) return filtered;
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(log =>
            log.action.toLowerCase().includes(term) ||
            log.actor_type.toLowerCase().includes(term) ||
            auditActorLabel(log, users, agents).toLowerCase().includes(term) ||
            log.resource_type.toLowerCase().includes(term) ||
            JSON.stringify(log.details ?? {}).toLowerCase().includes(term)
        );

        if (sortConfig && sortConfig.key === "logs") {
            filtered = [...filtered].sort((a, b) => {
                const aValue = a.created_at;
                const bValue = b.created_at;
                if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [auditLogs, searchTerm, sortConfig, users, agents]);

    const filteredCredentials = useMemo(() => {
        let filtered = credentials;
        if (!searchTerm) return filtered;
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(c => {
            const server = servers.find(s => s.id === c.server_id);
            return c.managed_account.toLowerCase().includes(term) ||
                c.server_id.toLowerCase().includes(term) ||
                (server?.name.toLowerCase().includes(term) ?? false) ||
                (server?.site.toLowerCase().includes(term) ?? false);
        });

        if (sortConfig && sortConfig.key === "credentials") {
            filtered = [...filtered].sort((a, b) => {
                const aValue = a.managed_account;
                const bValue = b.managed_account;
                if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [credentials, servers, searchTerm, sortConfig]);

    const filteredUsers = useMemo(() => {
        let filtered = users;
        if (!searchTerm) return filtered;
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(u =>
            u.username.toLowerCase().includes(term) ||
            u.role.toLowerCase().includes(term) ||
            (u.active ? "active" : "inactive").includes(term)
        );

        if (sortConfig && sortConfig.key === "users") {
            filtered = [...filtered].sort((a, b) => {
                const aValue = a.username;
                const bValue = b.username;
                if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [users, searchTerm, sortConfig]);

    const handleSort = (table: string) => {
        setSortConfig(current => {
            if (!current || current.key !== table) {
                return { key: table, direction: "asc" };
            }
            return {
                key: table,
                direction: current.direction === "asc" ? "desc" : "asc"
            };
        });
    };

    async function handleDialogConfirm(values: Record<string, string>): Promise<void> {
        if (!dialog) return;
        setDialogBusy(true);
        try {
            const ok = await dialog.onConfirm(values);
            if (ok !== false) setDialog(null);
        } finally {
            setDialogBusy(false);
        }
    }

    function openRevealDialog(credential: Credential, serverName?: string): void {
        if (!session) return;
        setDialog({
            title: "Emergency Reveal",
            description: `Decrypting password for ${credential.managed_account} on ${serverName ?? credential.server_id}. This action is audited.`,
            confirmLabel: "Reveal Password",
            tone: "danger",
            onConfirm: async () => {
                try {
                    const data = await apiRequest<RevealCredentialResponse>(`/admin/credentials/${credential.id}/reveal`, { token: session.token });
                    setRevealData(data);
                    setRevealTimestamp(new Date().toISOString());
                    addToast("Password revealed and audited.", "success");
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to reveal", "error");
                    return false;
                }
            }
        });
    }

    async function testSshStatus(credential: Credential): Promise<void> {
        if (!session) return;
        const server = servers.find(s => s.id === credential.server_id);
        setCheckingSshId(credential.id);
        addToast(`Testing SSH status for ${credential.managed_account} on ${server?.name ?? credential.server_id}...`, "info");
        try {
            const data = await apiRequest<CredentialSshStatusResponse>(
                `/access-requests/credentials/${credential.id}/ssh-status`,
                { method: "POST", token: session.token },
            );
            setSshStatuses((current) => ({ ...current, [credential.id]: data }));
            addToast(data.message, data.ok ? "success" : "error");
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to test SSH status", "error");
        } finally {
            setCheckingSshId(null);
        }
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
                    const nextRole = values.role as UserRole;
                    const nextActive = values.active === "active";
                    const requests: Promise<unknown>[] = [];

                    if (nextRole !== user.role) {
                        const payload: UserUpdatePayload = { role: nextRole };
                        requests.push(apiRequest(`/admin/users/${user.id}`, {
                            method: "PATCH",
                            token: session.token,
                            body: JSON.stringify(payload)
                        }));
                    }

                    if (nextActive !== user.active) {
                        const endpoint = nextActive
                            ? `/admin/users/${user.id}/restore`
                            : `/admin/users/${user.id}/deactivate`;
                        requests.push(apiRequest(endpoint, {
                            method: "POST",
                            token: session.token
                        }));
                    }

                    if (requests.length === 0) {
                        addToast("No changes to save", "info");
                        return true;
                    }

                    await Promise.all(requests);
                    addToast("User updated", "success");
                    await loadUsers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to update user", "error");
                    return false;
                }
            }
        });
    }

    function openDeleteUserDialog(user: User): void {
        if (!session) return;
        setDialog({
            title: "Delete User",
            description: `Permanently deleting user ${user.username}. This action cannot be undone.`,
            confirmLabel: "Delete User",
            tone: "danger",
            onConfirm: async () => {
                try {
                    await apiRequest(`/admin/users/${user.id}`, { method: "DELETE", token: session.token });
                    addToast("User deleted", "success");
                    await loadUsers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to delete user", "error");
                    return false;
                }
            }
        });
    }

    async function handleCreateUser(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!session) return;
        const fd = new FormData(e.currentTarget);
        try {
            await apiRequest("/admin/users", {
                method: "POST",
                token: session.token,
                body: JSON.stringify(Object.fromEntries(fd))
            });
            addToast("User created", "success");
            e.currentTarget.reset();
            await loadUsers();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Error", "error");
        }
    }

    const openCreateAgentDialog = (): void => {
        if (!session) return;
        const currentSession = session;
        setDialog({
            title: "Create Agent",
            description: "Create a new agent for managing servers.",
            confirmLabel: "Create Agent",
            fields: [
                { name: "name", label: "Agent Name", type: "text", required: true },
                { name: "site", label: "Site", type: "text", required: true }
            ],
            onConfirm: async (values) => {
                try {
                    const data = await apiRequest<{ agent: any, api_token: string }>("/admin/agents", {
                        method: "POST",
                        token: currentSession.token,
                        body: JSON.stringify(values)
                    });
                    addToast(`Agent created. API Token: ${data.api_token}`, "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to create agent", "error");
                    return false;
                }
            }
        });
    };

    const openCreateServerDialog = (): void => {
        if (!session) return;
        const agentOptions = agents.filter(a => a.active).map(a => ({ label: `${a.name} (${a.site})`, value: a.id }));

        setDialog({
            title: "Create Server",
            description: "Add a new target server to manage.",
            confirmLabel: "Create Server",
            fields: [
                { name: "name", label: "Server Name", type: "text", required: true },
                { name: "agent_id", label: "Agent", type: "select", required: true, options: agentOptions },
                { name: "os_type", label: "OS Type", type: "select", required: true, options: [{ label: "UNIX", value: "unix" }, { label: "Windows", value: "windows" }] },
                { name: "host", label: "Host", type: "text", required: true },
                { name: "port", label: "Port", type: "number", defaultValue: "22" }
            ],
            onConfirm: async (values) => {
                try {
                    await apiRequest("/admin/servers", {
                        method: "POST",
                        token: session.token,
                        body: JSON.stringify({ ...values, port: parseInt(values.port, 10), connection_profile: "password" })
                    });
                    addToast("Server created", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to create server", "error");
                    return false;
                }
            }
        });
    };

    const openCreateCredentialDialog = (): void => {
        if (!session) return;
        const serverOptions = servers.map(s => ({ label: `${s.name} (${s.site})`, value: s.id }));

        setDialog({
            title: "Create Credential",
            description: "Add credentials for a managed account on a server.",
            confirmLabel: "Create Credential",
            fields: [
                { name: "server_id", label: "Server", type: "select", required: true, options: serverOptions },
                { name: "managed_account", label: "Managed Account", type: "text", required: true },
                { name: "initial_password", label: "Initial Password", type: "password", required: true }
            ],
            onConfirm: async (values) => {
                try {
                    await apiRequest("/admin/credentials", {
                        method: "POST",
                        token: session.token,
                        body: JSON.stringify(values)
                    });
                    addToast("Credential created", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to create credential", "error");
                    return false;
                }
            }
        });
    };

    const openEditAgentDialog = (agent: Agent): void => {
        if (!session) return;
        setDialog({
            title: "Edit Agent",
            description: `Updating agent ${agent.name}.`,
            confirmLabel: "Save Changes",
            fields: [
                { name: "name", label: "Agent Name", type: "text", required: true, defaultValue: agent.name },
                { name: "site", label: "Site", type: "text", required: true, defaultValue: agent.site },
                { name: "active", label: "Status", type: "select", required: true, defaultValue: agent.active ? "active" : "inactive", options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] }
            ],
            onConfirm: async (values) => {
                const payload: AgentUpdatePayload = {
                    name: values.name,
                    site: values.site,
                    active: values.active === "active"
                };
                try {
                    await apiRequest(`/admin/agents/${agent.id}`, {
                        method: "PATCH",
                        token: session.token,
                        body: JSON.stringify(payload)
                    });
                    addToast("Agent updated", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to update agent", "error");
                    return false;
                }
            }
        });
    };

    const openDeleteAgentDialog = (agent: Agent): void => {
        if (!session) return;
        const assignedServers = servers.filter(s => s.agent_id === agent.id).length;
        setDialog({
            title: "Delete Agent",
            description: `Delete ${agent.name}? This also removes ${assignedServers} assigned server${assignedServers === 1 ? "" : "s"} and their credentials.`,
            confirmLabel: "Delete Agent",
            tone: "danger",
            onConfirm: async () => {
                try {
                    await apiRequest(`/admin/agents/${agent.id}`, { method: "DELETE", token: session.token });
                    addToast("Agent deleted", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to delete agent", "error");
                    return false;
                }
            }
        });
    };

    const openEditServerDialog = (server: TargetServer): void => {
        if (!session) return;
        const agentOptions = agents.filter(a => a.active || a.id === server.agent_id).map(a => ({ label: `${a.name} (${a.site})`, value: a.id }));
        setDialog({
            title: "Edit Server",
            description: `Updating server ${server.name}.`,
            confirmLabel: "Save Changes",
            fields: [
                { name: "name", label: "Server Name", type: "text", required: true, defaultValue: server.name },
                { name: "agent_id", label: "Agent", type: "select", required: true, defaultValue: server.agent_id, options: agentOptions },
                { name: "os_type", label: "OS Type", type: "select", required: true, defaultValue: server.os_type, options: [{ label: "UNIX", value: "unix" }, { label: "Windows", value: "windows" }] },
                { name: "host", label: "Host", type: "text", required: true, defaultValue: server.host },
                { name: "port", label: "Port", type: "number", defaultValue: String(server.port) }
            ],
            onConfirm: async (values) => {
                const payload: TargetServerUpdatePayload = {
                    name: values.name,
                    agent_id: values.agent_id,
                    os_type: values.os_type as TargetServer["os_type"],
                    host: values.host,
                    port: parseInt(values.port, 10),
                    connection_profile: "password"
                };
                try {
                    await apiRequest(`/admin/servers/${server.id}`, {
                        method: "PATCH",
                        token: session.token,
                        body: JSON.stringify(payload)
                    });
                    addToast("Server updated", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to update server", "error");
                    return false;
                }
            }
        });
    };

    const openDeleteServerDialog = (server: TargetServer): void => {
        if (!session) return;
        const credentialCount = credentials.filter(c => c.server_id === server.id).length;
        setDialog({
            title: "Delete Server",
            description: `Delete ${server.name}? This also removes ${credentialCount} credential${credentialCount === 1 ? "" : "s"} for this server.`,
            confirmLabel: "Delete Server",
            tone: "danger",
            onConfirm: async () => {
                try {
                    await apiRequest(`/admin/servers/${server.id}`, { method: "DELETE", token: session.token });
                    addToast("Server deleted", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to delete server", "error");
                    return false;
                }
            }
        });
    };

    const openEditCredentialDialog = (credential: Credential): void => {
        if (!session) return;
        const serverOptions = servers.map(s => ({ label: `${s.name} (${s.site})`, value: s.id }));
        setDialog({
            title: "Edit Credential",
            description: `Updating credential for ${credential.managed_account}. Leave password blank to keep the current password.`,
            confirmLabel: "Save Changes",
            fields: [
                { name: "server_id", label: "Server", type: "select", required: true, defaultValue: credential.server_id, options: serverOptions },
                { name: "managed_account", label: "Managed Account", type: "text", required: true, defaultValue: credential.managed_account },
                { name: "password", label: "New Password", type: "password", helper: "Optional. Enter a value only when rotating or correcting this password." }
            ],
            onConfirm: async (values) => {
                const payload: CredentialUpdatePayload = {
                    server_id: values.server_id,
                    managed_account: values.managed_account
                };
                if (values.password) {
                    payload.password = values.password;
                }
                try {
                    await apiRequest(`/admin/credentials/${credential.id}`, {
                        method: "PATCH",
                        token: session.token,
                        body: JSON.stringify(payload)
                    });
                    addToast("Credential updated", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to update credential", "error");
                    return false;
                }
            }
        });
    };

    const openDeleteCredentialDialog = (credential: Credential): void => {
        if (!session) return;
        const server = servers.find(s => s.id === credential.server_id);
        setDialog({
            title: "Delete Credential",
            description: `Delete ${credential.managed_account} on ${server?.name ?? credential.server_id}? This action cannot be undone.`,
            confirmLabel: "Delete Credential",
            tone: "danger",
            onConfirm: async () => {
                try {
                    await apiRequest(`/admin/credentials/${credential.id}`, { method: "DELETE", token: session.token });
                    addToast("Credential deleted", "success");
                    await loadServers();
                    return true;
                } catch (error) {
                    addToast(error instanceof Error ? error.message : "Failed to delete credential", "error");
                    return false;
                }
            }
        });
    };

    if (!session) return <div className="layout" />;

    const revealPayload = revealData
        ? `server=${revealData.server_name}\nmanaged_account=${revealData.managed_account}\npassword=${revealData.password}`
        : "";

    return (
        <div className="layout">
            <Sidebar activeTab={activeTab} tabs={TABS} onTabChange={setActiveTab} />
            <main className="main-content">
                <div className="page-shell">
                    <header className="page-header">
                        <div>
                            <h1 className="page-title">Administrative Control</h1>
                        </div>
                        <HeaderActions />
                    </header>

                    <div className="stats-grid">
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
                        <StatCard
                            label="System Logs"
                            value={stats.logs}
                            variant="default"
                            icon={<IconAlert className="icon-lg" />}
                        />
                    </div>

                    <div className="card">
                        <div className="tabs">
                            {TABS.map(t => (
                                <Button key={t.id} variant={activeTab === t.id ? "default" : "ghost"} onClick={() => setActiveTab(t.id)}>{t.label}</Button>
                            ))}
                        </div>

                        {activeTab === "servers" && (
                            <div>
                                <div className="mb-4 flex justify-between items-center">
                                    <SearchInput
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Search servers by name, site, or host..."
                                    />
                                    <div className="flex gap-2">
                                        <Button onClick={openCreateServerDialog}>
                                            <IconServer className="w-4 h-4 mr-2" />
                                            Add Server
                                        </Button>
                                    </div>
                                </div>
                                <div className="table-wrap">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Site</TableHead>
                                                <TableHead>Host</TableHead>
                                                <TableHead>OS</TableHead>
                                                <TableHead>Agent</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {servers.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                        No servers configured. Add your first server to get started.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                servers.filter(s => {
                                                    if (!searchTerm) return true;
                                                    const term = searchTerm.toLowerCase();
                                                    return s.name.toLowerCase().includes(term) ||
                                                        s.site.toLowerCase().includes(term) ||
                                                        s.host.toLowerCase().includes(term);
                                                }).map(s => (
                                                    <TableRow key={s.id}>
                                                        <TableCell className="font-medium">{s.name}</TableCell>
                                                        <TableCell>{s.site}</TableCell>
                                                        <TableCell>{s.host}:{s.port}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={s.os_type === "windows" ? "default" : "secondary"}>
                                                                {s.os_type.toUpperCase()}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>{agents.find(a => a.id === s.agent_id)?.name ?? "Unknown"}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" size="icon" onClick={() => openEditServerDialog(s)} title="Edit server">
                                                                    <IconEdit className="w-4 h-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => openDeleteServerDialog(s)} title="Delete server">
                                                                    <IconTrash className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {activeTab === "agents" && (
                            <div>
                                <div className="mb-4 flex justify-between items-center">
                                    <SearchInput
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Search agents by name or site..."
                                    />
                                    <Button onClick={openCreateAgentDialog}>
                                        <IconInbox className="w-4 h-4 mr-2" />
                                        Add Agent
                                    </Button>
                                </div>
                                <div className="table-wrap">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Site</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Last Seen</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {agents.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                        No agents configured. Add your first agent to get started.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                agents.filter(a => {
                                                    if (!searchTerm) return true;
                                                    const term = searchTerm.toLowerCase();
                                                    return a.name.toLowerCase().includes(term) ||
                                                        a.site.toLowerCase().includes(term);
                                                }).map(a => (
                                                    <TableRow key={a.id}>
                                                        <TableCell className="font-medium">{a.name}</TableCell>
                                                        <TableCell>{a.site}</TableCell>
                                                        <TableCell>
                                                            <StatusBadge status={a.active ? "active" : "inactive"} />
                                                        </TableCell>
                                                        <TableCell>{a.last_seen_at ? formatDate(a.last_seen_at) : "Never"}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" size="icon" onClick={() => openEditAgentDialog(a)} title="Edit agent">
                                                                    <IconEdit className="w-4 h-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => openDeleteAgentDialog(a)} title="Delete agent">
                                                                    <IconTrash className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {activeTab === "credentials" && (
                            <div>
                                <div className="mb-4 flex justify-between items-center">
                                    <SearchInput
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Search credentials by server or account..."
                                    />
                                    <Button onClick={openCreateCredentialDialog}>
                                        <IconKey className="w-4 h-4 mr-2" />
                                        Add Credential
                                    </Button>
                                </div>
                                <div className="table-wrap">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Server</TableHead>
                                                <TableHead>Account</TableHead>
                                                <TableHead>Version</TableHead>
                                                <TableHead>Last Sync</TableHead>
                                                <TableHead>Sync Source</TableHead>
                                                <TableHead>SSH Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {credentials.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                        No credentials configured. Add your first credential to get started.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                credentials.filter(c => {
                                                    if (!searchTerm) return true;
                                                    const term = searchTerm.toLowerCase();
                                                    const server = servers.find(s => s.id === c.server_id);
                                                    return c.managed_account.toLowerCase().includes(term) ||
                                                        (server?.name.toLowerCase().includes(term) ?? false);
                                                }).map(c => {
                                                    const server = servers.find(s => s.id === c.server_id);
                                                    const handleReveal = () => openRevealDialog(c);
                                                    return (
                                                        <TableRow key={c.id}>
                                                            <TableCell className="font-medium">{server?.name ?? "Unknown"}</TableCell>
                                                            <TableCell>{c.managed_account}</TableCell>
                                                            <TableCell>v{c.version}</TableCell>
                                                            <TableCell>{formatDate(c.last_synced_at)}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary">{c.last_sync_source}</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                {sshStatuses[c.id] ? (
                                                                    <Badge variant={sshStatuses[c.id].ok ? "default" : "destructive"}>
                                                                        {sshStatuses[c.id].status.replaceAll("_", " ")}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">Not tested</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => testSshStatus(c)}
                                                                        disabled={checkingSshId === c.id}
                                                                        title="Test SSH status"
                                                                    >
                                                                        <IconActivity className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={handleReveal} title="Reveal password">
                                                                        <IconEye className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => openEditCredentialDialog(c)} title="Edit credential">
                                                                        <IconEdit className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => openDeleteCredentialDialog(c)} title="Delete credential">
                                                                        <IconTrash className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {revealData && (
                                    <div className="mt-4 space-y-3 border border-destructive/30 bg-destructive/5 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">Revealed credential</div>
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    <Badge variant="outline">{revealData.server_name}</Badge>
                                                    <Badge variant="secondary">{revealData.managed_account}</Badge>
                                                    {revealTimestamp && <span>Revealed {formatDate(revealTimestamp)}</span>}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setRevealData(null);
                                                    setRevealTimestamp(null);
                                                }}
                                            >
                                                Hide
                                            </Button>
                                        </div>
                                        <pre className="overflow-x-auto bg-background p-4 text-sm text-foreground">{revealPayload}</pre>
                                    </div>
                                )}
                            </div>
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
                                                        {roleOptions.map(o => (
                                                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                        ))}
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
                                        <CardTitle>Users</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="mb-4">
                                            <SearchInput
                                                value={searchTerm}
                                                onChange={setSearchTerm}
                                                placeholder="Search users by name, role, or status..."
                                            />
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => handleSort("users")}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            User
                                                            {sortConfig?.key === "users" && (
                                                                <span className="text-xs">
                                                                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredUsers.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                            {searchTerm ? "No users found matching your search." : "No users found."}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredUsers.map(u => (
                                                        <TableRow key={u.id}>
                                                            <TableCell className="font-medium">{u.username}</TableCell>
                                                            <TableCell className="capitalize">{u.role}</TableCell>
                                                            <TableCell>
                                                                <StatusBadge status={u.active ? "active" : "inactive"} />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => openEditUserDialog(u)}
                                                                    disabled={u.username === session.username}
                                                                >
                                                                    <IconEdit className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => openDeleteUserDialog(u)}
                                                                    disabled={u.username === session.username}
                                                                >
                                                                    <IconTrash className="w-4 h-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        )}

                        {activeTab === "logs" && (
                            <CardContent>
                                <div className="mb-4">
                                    <SearchInput
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Search logs by action, actor, resource, IP, or browser..."
                                    />
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => handleSort("logs")}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Timestamp
                                                    {sortConfig?.key === "logs" && (
                                                        <span className="text-xs">
                                                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead>Actor</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Resource</TableHead>
                                            <TableHead>IP Address</TableHead>
                                            <TableHead>Browser</TableHead>
                                            <TableHead>Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredAuditLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                    {searchTerm ? "No logs found matching your search." : "No audit logs available."}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredAuditLogs.map(log => {
                                                const request = auditRequestDetails(log);
                                                const detailEntries = auditDetailEntries(log.details || {});
                                                const actorLabel = auditActorLabel(log, users, agents);

                                                return (
                                                    <TableRow key={log.id}>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {formatDate(log.created_at)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{log.actor_type}</Badge>
                                                            <span className="ml-2 text-sm">{actorLabel}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary">{log.action}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-sm">{log.resource_type}</span>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {formatAuditValue(request.ip_address)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1 text-xs">
                                                                <div className="font-medium text-foreground">{formatAuditValue(request.browser)}</div>
                                                                <div className="max-w-[260px] truncate text-muted-foreground" title={formatAuditValue(request.user_agent)}>
                                                                    {formatAuditValue(request.user_agent)}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                                <div><strong>method:</strong> {formatAuditValue(request.method)}</div>
                                                                <div><strong>path:</strong> {formatAuditValue(request.path)}</div>
                                                                {detailEntries.map(([key, value]) => (
                                                                    <div key={key}>
                                                                        <strong>{key}:</strong> {formatAuditValue(value)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        )}
                    </div>
                </div>
            </main>
            <ConfirmDialog
                open={Boolean(dialog)}
                title={dialog?.title ?? ""}
                description={dialog?.description}
                confirmLabel={dialog?.confirmLabel}
                tone={dialog?.tone}
                fields={dialog?.fields}
                busy={dialogBusy}
                onConfirm={handleDialogConfirm}
                onClose={() => setDialog(null)}
            />
        </div>
    );
}
