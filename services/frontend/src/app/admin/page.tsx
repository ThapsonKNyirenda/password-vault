"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "../../components/AppHeader";
import { ConfirmDialog, type ConfirmDialogField } from "../../components/ConfirmDialog";
import { IconAlert, IconEdit, IconEye, IconRefresh, IconRestore, IconTrash, IconUser } from "../../components/Icons";
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

export default function AdminPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);

    const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [servers, setServers] = useState<TargetServer[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [pendingMessage, setPendingMessage] = useState("");
    const [pendingMessageType, setPendingMessageType] = useState<"" | "error" | "success">("");
    const [setupMessage, setSetupMessage] = useState("");
    const [setupMessageType, setSetupMessageType] = useState<"" | "error" | "success">("");
    const [userMessage, setUserMessage] = useState("");
    const [userMessageType, setUserMessageType] = useState<"" | "error" | "success">("");
    const [revealData, setRevealData] = useState<RevealCredentialResponse | null>(null);
    const [revealTimestamp, setRevealTimestamp] = useState<string | null>(null);
    const [revealMessage, setRevealMessage] = useState("");
    const [revealMessageType, setRevealMessageType] = useState<"" | "error" | "success">("");
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [dialogBusy, setDialogBusy] = useState(false);
    const [validation, setValidation] = useState<Record<string, boolean>>({});

    function handleInvalid(formKey: string, area: "user" | "setup") {
        return (event: FormEvent<HTMLFormElement>): void => {
            event.preventDefault();
            setValidation((prev) => ({ ...prev, [formKey]: true }));
            if (area === "user") {
                setUserMessage("Please complete all required fields.");
                setUserMessageType("error");
            } else {
                setSetupMessage("Please complete all required fields.");
                setSetupMessageType("error");
            }
        };
    }

    const loadPendingRequests = useCallback(async (): Promise<void> => {
        if (!session) {
            return;
        }

        try {
            const data = await apiRequest<AccessRequest[]>("/access-requests/pending", {
                token: session.token,
            });
            setPendingRequests(data);
        } catch (error) {
            setPendingMessage(error instanceof Error ? error.message : "Failed to load pending requests");
            setPendingMessageType("error");
        }
    }, [session]);

    const loadInventory = useCallback(async (): Promise<void> => {
        if (!session) {
            return;
        }

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
            setSetupMessage(error instanceof Error ? error.message : "Failed to load inventory");
            setSetupMessageType("error");
        }
    }, [session]);

    const loadUsers = useCallback(async (): Promise<void> => {
        if (!session) {
            return;
        }

        try {
            const data = await apiRequest<User[]>("/admin/users?include_inactive=true", {
                token: session.token,
            });
            setUsers(data);
        } catch (error) {
            setUserMessage(error instanceof Error ? error.message : "Failed to load users");
            setUserMessageType("error");
        }
    }, [session]);

    useEffect(() => {
        if (!session) {
            router.replace("/login");
            return;
        }
        if (session.role !== "admin") {
            router.replace("/engineer");
            return;
        }

        void Promise.all([loadPendingRequests(), loadInventory(), loadUsers()]);
    }, [loadInventory, loadPendingRequests, loadUsers, router, session]);

    const activeUserCount = useMemo(() => users.filter((user) => user.active).length, [users]);
    const inactiveUserCount = useMemo(() => users.filter((user) => !user.active).length, [users]);
    const activeAgentCount = useMemo(() => agents.filter((agent) => agent.active).length, [agents]);

    async function handleDialogConfirm(values: Record<string, string>): Promise<void> {
        if (!dialog) {
            return;
        }
        setDialogBusy(true);
        try {
            const shouldClose = await dialog.onConfirm(values);
            if (shouldClose !== false) {
                setDialog(null);
            }
        } finally {
            setDialogBusy(false);
        }
    }

    function openApproveDialog(request: AccessRequest): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Approve access request",
            description: `Approve request ${request.id} for credential ${request.credential_id}.`,
            confirmLabel: "Approve",
            fields: [
                {
                    name: "expires_minutes",
                    label: "Credential validity (minutes)",
                    type: "number",
                    defaultValue: "15",
                    min: 5,
                    max: 120,
                    helper: "Minimum 5 minutes, maximum 120.",
                },
            ],
            onConfirm: async (values) => {
                try {
                    const expiresMinutes = Number.parseInt(values.expires_minutes ?? "15", 10);
                    if (Number.isNaN(expiresMinutes)) {
                        setPendingMessage("Enter a valid expiration in minutes.");
                        setPendingMessageType("error");
                        return false;
                    }
                    await apiRequest<AccessRequest>(`/access-requests/${request.id}/approve`, {
                        method: "POST",
                        token: session.token,
                        body: JSON.stringify({ expires_minutes: expiresMinutes }),
                    });

                    setPendingMessage("Request approved");
                    setPendingMessageType("success");
                    await Promise.all([loadPendingRequests(), loadInventory()]);
                    return true;
                } catch (error) {
                    setPendingMessage(error instanceof Error ? error.message : "Failed to approve request");
                    setPendingMessageType("error");
                    return false;
                }
            },
        });
    }

    function openDenyDialog(request: AccessRequest): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Deny access request",
            description: `Provide a denial note for request ${request.id}.`,
            confirmLabel: "Deny request",
            tone: "danger",
            fields: [
                {
                    name: "note",
                    label: "Optional deny note",
                    type: "textarea",
                    placeholder: "Not authorized for this task",
                },
            ],
            onConfirm: async (values) => {
                try {
                    await apiRequest<AccessRequest>(`/access-requests/${request.id}/deny`, {
                        method: "POST",
                        token: session.token,
                        body: JSON.stringify({ note: values.note ?? "" }),
                    });

                    setPendingMessage("Request denied");
                    setPendingMessageType("success");
                    await loadPendingRequests();
                    return true;
                } catch (error) {
                    setPendingMessage(error instanceof Error ? error.message : "Failed to deny request");
                    setPendingMessageType("error");
                    return false;
                }
            },
        });
    }

    function openRevealDialog(credential: Credential, serverName?: string): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Reveal tracked password",
            description: `Decrypt password for ${credential.managed_account} on ${serverName ?? credential.server_id}.`,
            confirmLabel: "Reveal password",
            tone: "danger",
            onConfirm: async () => {
                try {
                    const data = await apiRequest<RevealCredentialResponse>(
                        `/admin/credentials/${credential.id}/reveal`,
                        { token: session.token },
                    );
                    setRevealData(data);
                    setRevealTimestamp(new Date().toISOString());
                    setRevealMessage("Password revealed and audited.");
                    setRevealMessageType("success");
                    return true;
                } catch (error) {
                    setRevealMessage(error instanceof Error ? error.message : "Failed to reveal password");
                    setRevealMessageType("error");
                    return false;
                }
            },
        });
    }

    function openUpdatePasswordDialog(credential: Credential): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Update tracked password",
            description: `Store the new password for ${credential.managed_account}.`,
            confirmLabel: "Update password",
            fields: [
                {
                    name: "password",
                    label: "Current password",
                    type: "password",
                    required: true,
                    helper: "Stored immediately in the vault.",
                },
            ],
            onConfirm: async (values) => {
                try {
                    await apiRequest<Credential>(`/admin/credentials/${credential.id}/password`, {
                        method: "PUT",
                        token: session.token,
                        body: JSON.stringify({ password: values.password }),
                    });
                    setSetupMessage("Tracked password updated");
                    setSetupMessageType("success");
                    await loadInventory();
                    return true;
                } catch (error) {
                    setSetupMessage(error instanceof Error ? error.message : "Failed to update tracked password");
                    setSetupMessageType("error");
                    return false;
                }
            },
        });
    }

    function openEditUserDialog(user: User): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Edit user",
            description: `Update profile for ${user.username}.`,
            confirmLabel: "Save changes",
            fields: [
                {
                    name: "username",
                    label: "Username",
                    defaultValue: user.username,
                    required: true,
                },
                {
                    name: "role",
                    label: "Role",
                    type: "select",
                    defaultValue: user.role,
                    options: roleOptions,
                },
                {
                    name: "password",
                    label: "Reset password (optional)",
                    type: "password",
                    placeholder: "Leave blank to keep current",
                    helper: "Minimum 12 characters if set.",
                },
            ],
            onConfirm: async (values) => {
                try {
                    const payload: UserUpdatePayload = {};
                    const nextUsername = values.username?.trim();
                    if (nextUsername && nextUsername !== user.username) {
                        payload.username = nextUsername;
                    }
                    if (values.role && values.role !== user.role) {
                        payload.role = values.role as UserRole;
                    }
                    if (values.password) {
                        payload.password = values.password;
                    }
                    if (Object.keys(payload).length === 0) {
                        setUserMessage("No changes to save.");
                        setUserMessageType("");
                        return true;
                    }

                    await apiRequest<User>(`/admin/users/${user.id}`, {
                        method: "PATCH",
                        token: session.token,
                        body: JSON.stringify(payload),
                    });
                    setUserMessage("User updated");
                    setUserMessageType("success");
                    await loadUsers();
                    return true;
                } catch (error) {
                    setUserMessage(error instanceof Error ? error.message : "Failed to update user");
                    setUserMessageType("error");
                    return false;
                }
            },
        });
    }

    function openDeactivateUserDialog(user: User): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Delete user",
            description: `Soft delete ${user.username}. Access is revoked until restored.`,
            confirmLabel: "Delete (soft)",
            tone: "danger",
            onConfirm: async () => {
                try {
                    await apiRequest<User>(`/admin/users/${user.id}/deactivate`, {
                        method: "POST",
                        token: session.token,
                    });
                    setUserMessage("User soft-deleted");
                    setUserMessageType("success");
                    await loadUsers();
                    return true;
                } catch (error) {
                    setUserMessage(error instanceof Error ? error.message : "Failed to delete user");
                    setUserMessageType("error");
                    return false;
                }
            },
        });
    }

    function openRestoreUserDialog(user: User): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Restore user",
            description: `Restore access for ${user.username}.`,
            confirmLabel: "Restore",
            onConfirm: async () => {
                try {
                    await apiRequest<User>(`/admin/users/${user.id}/restore`, {
                        method: "POST",
                        token: session.token,
                    });
                    setUserMessage("User restored");
                    setUserMessageType("success");
                    await loadUsers();
                    return true;
                } catch (error) {
                    setUserMessage(error instanceof Error ? error.message : "Failed to restore user");
                    setUserMessageType("error");
                    return false;
                }
            },
        });
    }

    async function handleCreateAgent(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!session) {
            return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
            name: String(formData.get("name") ?? "").trim(),
            site: String(formData.get("site") ?? "").trim(),
        };

        try {
            const result = await apiRequest<AgentCreateResponse>("/admin/agents", {
                method: "POST",
                token: session.token,
                body: JSON.stringify(payload),
            });

            setSetupMessage(`Agent created. Token: ${result.api_token}`);
            setSetupMessageType("success");
            form.reset();
            setValidation((prev) => ({ ...prev, createAgent: false }));
            await loadInventory();
        } catch (error) {
            setSetupMessage(error instanceof Error ? error.message : "Failed to create agent");
            setSetupMessageType("error");
        }
    }

    async function handleCreateServer(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!session) {
            return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
            name: String(formData.get("name") ?? "").trim(),
            site: String(formData.get("site") ?? "").trim(),
            agent_id: String(formData.get("agent_id") ?? "").trim(),
            os_type: String(formData.get("os_type") ?? "unix"),
            host: String(formData.get("host") ?? "").trim(),
            port: Number(formData.get("port") ?? 22),
            managed_account: String(formData.get("managed_account") ?? "").trim(),
            connection_username: String(formData.get("connection_username") ?? "").trim(),
            connection_profile: String(formData.get("connection_profile") ?? "default").trim(),
        };

        try {
            await apiRequest<TargetServer>("/admin/servers", {
                method: "POST",
                token: session.token,
                body: JSON.stringify(payload),
            });

            setSetupMessage("Server created successfully");
            setSetupMessageType("success");
            form.reset();
            setValidation((prev) => ({ ...prev, createServer: false }));
            await loadInventory();
        } catch (error) {
            setSetupMessage(error instanceof Error ? error.message : "Failed to create server");
            setSetupMessageType("error");
        }
    }

    async function handleCreateCredential(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!session) {
            return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
            server_id: String(formData.get("server_id") ?? "").trim(),
            managed_account: String(formData.get("managed_account") ?? "").trim(),
            initial_password: String(formData.get("initial_password") ?? ""),
        };

        try {
            await apiRequest<Credential>("/admin/credentials", {
                method: "POST",
                token: session.token,
                body: JSON.stringify(payload),
            });

            setSetupMessage("Tracked credential created successfully");
            setSetupMessageType("success");
            form.reset();
            setValidation((prev) => ({ ...prev, createCredential: false }));
            await loadInventory();
        } catch (error) {
            setSetupMessage(error instanceof Error ? error.message : "Failed to create credential");
            setSetupMessageType("error");
        }
    }

    async function handleCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!session) {
            return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
            username: String(formData.get("username") ?? "").trim(),
            password: String(formData.get("password") ?? ""),
            role: String(formData.get("role") ?? "engineer"),
        };

        try {
            await apiRequest<User>("/admin/users", {
                method: "POST",
                token: session.token,
                body: JSON.stringify(payload),
            });

            setUserMessage("User created successfully");
            setUserMessageType("success");
            form.reset();
            setValidation((prev) => ({ ...prev, createUser: false }));
            await loadUsers();
        } catch (error) {
            setUserMessage(error instanceof Error ? error.message : "Failed to create user");
            setUserMessageType("error");
        }
    }

    if (!session) {
        return <main className="app-shell page" />;
    }

    const revealPayload = revealData
        ? `server=${revealData.server_name}\nmanaged_account=${revealData.managed_account}\npassword=${revealData.password}`
        : "";

    return (
        <main className="app-shell page">
            <AppHeader />

            <section className="stats-strip">
                <div className="stat-card">
                    <h3>{pendingRequests.length}</h3>
                    <p>Pending Requests</p>
                </div>
                <div className="stat-card">
                    <h3>{credentials.length}</h3>
                    <p>Tracked Credentials</p>
                </div>
                <div className="stat-card">
                    <h3>{activeAgentCount}</h3>
                    <p>Active Agents</p>
                </div>
                <div className="stat-card">
                    <h3>{activeUserCount}</h3>
                    <p>Active Users (Inactive {inactiveUserCount})</p>
                </div>
            </section>

            <section className="grid-2">
                <article className="card">
                    <div className="card-header">
                        <div>
                            <h2 className="title-strong">Pending Access Requests</h2>
                            <p className="lead">Review and approve credential access.</p>
                        </div>
                        <button type="button" className="btn ghost" onClick={() => void loadPendingRequests()}>
                            <IconRefresh />
                            Refresh
                        </button>
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Requester</th>
                                    <th>Credential</th>
                                    <th>Reason</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>No pending requests.</td>
                                    </tr>
                                ) : (
                                    pendingRequests.map((request) => (
                                        <tr key={request.id}>
                                            <td>{request.id}</td>
                                            <td>{request.requester_id}</td>
                                            <td>{request.credential_id}</td>
                                            <td>{request.reason}</td>
                                            <td>
                                                <div className="table-actions">
                                                    <button type="button" className="btn primary" onClick={() => openApproveDialog(request)}>
                                                        <IconAlert />
                                                        Approve
                                                    </button>
                                                    <button type="button" className="btn danger" onClick={() => openDenyDialog(request)}>
                                                        <IconTrash />
                                                        Deny
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pendingMessage ? <div className={`toast ${pendingMessageType}`.trim()}>{pendingMessage}</div> : null}
                </article>

                <article className="card">
                    <div className="card-header">
                        <div>
                            <h2>User Management</h2>
                            <p className="lead">Create, edit, deactivate, and restore vault users.</p>
                        </div>
                        <button type="button" className="btn ghost" onClick={() => void loadUsers()}>
                            <IconRefresh />
                            Refresh
                        </button>
                    </div>

                    <div className="grid-2">
                        <form
                            className="stack"
                            data-validation={validation.createUser ? "true" : undefined}
                            onInvalidCapture={handleInvalid("createUser", "user")}
                            onSubmit={handleCreateUser}
                        >
                            <h3>Create User</h3>
                            <label htmlFor="user-username">
                                Username
                                <input id="user-username" name="username" required />
                            </label>
                            <label htmlFor="user-password">
                                Password
                                <input id="user-password" name="password" type="password" minLength={12} required />
                                <span className="field-help">Minimum 12 characters.</span>
                            </label>
                            <label htmlFor="user-role">
                                Role
                                <select id="user-role" name="role" defaultValue="engineer" required>
                                    {roleOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button className="btn primary" type="submit">
                                <IconUser />
                                Create User
                            </button>
                        </form>

                        <div>
                            <h3>User Directory</h3>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Username</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Created</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.length === 0 ? (
                                            <tr>
                                                <td colSpan={5}>No users found.</td>
                                            </tr>
                                        ) : (
                                            users.map((user) => (
                                                <tr key={user.id}>
                                                    <td>{user.username}</td>
                                                    <td>{user.role}</td>
                                                    <td>
                                                        <StatusBadge status={user.active ? "active" : "inactive"} />
                                                    </td>
                                                    <td>{formatDate(user.created_at)}</td>
                                                    <td>
                                                        <div className="table-actions">
                                                            <button type="button" className="btn ghost" onClick={() => openEditUserDialog(user)}>
                                                                <IconEdit />
                                                                Edit
                                                            </button>
                                                            {user.active ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn danger"
                                                                    onClick={() => openDeactivateUserDialog(user)}
                                                                >
                                                                    <IconTrash />
                                                                    Delete
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn secondary"
                                                                    onClick={() => openRestoreUserDialog(user)}
                                                                >
                                                                    <IconRestore />
                                                                    Restore
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {userMessage ? <div className={`toast ${userMessageType}`.trim()}>{userMessage}</div> : null}
                </article>
            </section>

            <section className="card">
                <div className="card-header">
                    <div>
                        <h2>Platform Setup</h2>
                        <p className="lead">Register agents, servers, and tracked credentials.</p>
                    </div>
                    <button type="button" className="btn ghost" onClick={() => void loadInventory()}>
                        <IconRefresh />
                        Refresh
                    </button>
                </div>

                <section className="grid-3">
                    <form
                        className="stack"
                        data-validation={validation.createAgent ? "true" : undefined}
                        onInvalidCapture={handleInvalid("createAgent", "setup")}
                        onSubmit={handleCreateAgent}
                    >
                        <h3>Create Agent</h3>
                        <label htmlFor="agent-name">
                            Name
                            <input id="agent-name" name="name" required />
                        </label>
                        <label htmlFor="agent-site">
                            Site
                            <input id="agent-site" name="site" required />
                        </label>
                        <button className="btn primary" type="submit">
                            Create Agent
                        </button>
                    </form>

                    <form
                        className="stack"
                        data-validation={validation.createServer ? "true" : undefined}
                        onInvalidCapture={handleInvalid("createServer", "setup")}
                        onSubmit={handleCreateServer}
                    >
                        <h3>Create Server</h3>
                        <label htmlFor="server-name">
                            Name
                            <input id="server-name" name="name" required />
                        </label>
                        <label htmlFor="server-site">
                            Site
                            <input id="server-site" name="site" required />
                        </label>
                        <label htmlFor="server-agent-id">
                            Agent
                            <select id="server-agent-id" name="agent_id" required>
                                {agents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name} ({agent.site})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label htmlFor="server-os-type">
                            OS
                            <select id="server-os-type" name="os_type" defaultValue="unix">
                                <option value="unix">unix</option>
                                <option value="windows">windows</option>
                            </select>
                        </label>
                        <label htmlFor="server-host">
                            Host
                            <input id="server-host" name="host" required />
                        </label>
                        <label htmlFor="server-port">
                            Port
                            <input id="server-port" name="port" type="number" defaultValue={22} required />
                        </label>
                        <label htmlFor="server-managed-account">
                            Managed Account
                            <input id="server-managed-account" name="managed_account" required />
                        </label>
                        <label htmlFor="server-connection-username">
                            Connection Username
                            <input id="server-connection-username" name="connection_username" required />
                        </label>
                        <label htmlFor="server-connection-profile">
                            Connection Profile
                            <input id="server-connection-profile" name="connection_profile" defaultValue="default" required />
                        </label>
                        <button className="btn primary" type="submit">
                            Create Server
                        </button>
                    </form>

                    <form
                        className="stack"
                        data-validation={validation.createCredential ? "true" : undefined}
                        onInvalidCapture={handleInvalid("createCredential", "setup")}
                        onSubmit={handleCreateCredential}
                    >
                        <h3>Create Tracked Credential</h3>
                        <label htmlFor="credential-server-id">
                            Server
                            <select id="credential-server-id" name="server_id" required>
                                {servers.map((server) => (
                                    <option key={server.id} value={server.id}>
                                        {server.name} ({server.site})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label htmlFor="credential-managed-account">
                            Managed Account
                            <input id="credential-managed-account" name="managed_account" required />
                        </label>
                        <label htmlFor="credential-initial-password">
                            Initial Password
                            <input
                                id="credential-initial-password"
                                name="initial_password"
                                type="password"
                                minLength={5}
                                required
                            />
                        </label>
                        <button className="btn primary" type="submit">
                            Create Credential
                        </button>
                    </form>
                </section>

                {setupMessage ? <div className={`toast ${setupMessageType}`.trim()}>{setupMessage}</div> : null}
            </section>

            <section className="grid-2">
                <article className="card">
                    <div className="card-header">
                        <div>
                            <h2>Tracked Credential Inventory</h2>
                            <p className="lead">Reveal or update vault passwords.</p>
                        </div>
                        <button type="button" className="btn ghost" onClick={() => void loadInventory()}>
                            <IconRefresh />
                            Refresh
                        </button>
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Credential ID</th>
                                    <th>Server</th>
                                    <th>Account</th>
                                    <th>Version</th>
                                    <th>Last Sync</th>
                                    <th>Source</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {credentials.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>No tracked credentials found.</td>
                                    </tr>
                                ) : (
                                    credentials.map((credential) => {
                                        const server = servers.find((item) => item.id === credential.server_id);
                                        return (
                                            <tr key={credential.id}>
                                                <td>{credential.id}</td>
                                                <td>{server?.name ?? credential.server_id}</td>
                                                <td>{credential.managed_account}</td>
                                                <td>{credential.version}</td>
                                                <td>{formatDate(credential.last_synced_at)}</td>
                                                <td>{credential.last_sync_source}</td>
                                                <td>
                                                    <div className="table-actions">
                                                        <button
                                                            type="button"
                                                            className="btn primary"
                                                            onClick={() => openRevealDialog(credential, server?.name)}
                                                        >
                                                            <IconEye />
                                                            Reveal
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn ghost"
                                                            onClick={() => openUpdatePasswordDialog(credential)}
                                                        >
                                                            <IconEdit />
                                                            Update
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>

                <article className="card">
                    <div className="card-header">
                        <div>
                            <h2>Credential Output</h2>
                            <p className="lead">Decrypt results are audited and time-stamped.</p>
                        </div>
                        {revealData ? (
                            <button
                                type="button"
                                className="btn ghost"
                                onClick={() => {
                                    setRevealData(null);
                                    setRevealTimestamp(null);
                                }}
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                    {revealData ? (
                        <>
                            <pre className="secret">{revealPayload}</pre>
                            <div className="secret-meta">
                                <span className="chip mono">{revealData.credential_id}</span>
                                <span>Revealed {formatDate(revealTimestamp ?? revealData.expires_at)}</span>
                            </div>
                        </>
                    ) : (
                        <p className="lead">No credential revealed yet.</p>
                    )}
                    {revealMessage ? <div className={`toast ${revealMessageType}`.trim()}>{revealMessage}</div> : null}
                </article>
            </section>

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
        </main>
    );
}
