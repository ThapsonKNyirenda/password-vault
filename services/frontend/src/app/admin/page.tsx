"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "../../components/AppHeader";
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
} from "../../lib/types";

export default function AdminPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);

    const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [servers, setServers] = useState<TargetServer[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);

    const [pendingMessage, setPendingMessage] = useState("");
    const [pendingMessageType, setPendingMessageType] = useState<"" | "error" | "success">("");
    const [setupMessage, setSetupMessage] = useState("");
    const [setupMessageType, setSetupMessageType] = useState<"" | "error" | "success">("");

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

    useEffect(() => {
        if (!session) {
            router.replace("/login");
            return;
        }
        if (session.role !== "admin") {
            router.replace("/engineer");
            return;
        }

        void Promise.all([loadPendingRequests(), loadInventory()]);
    }, [loadInventory, loadPendingRequests, router, session]);

    async function approveRequest(requestId: string): Promise<void> {
        if (!session) {
            return;
        }

        const expiresMinutesInput = window.prompt("Credential validity in minutes", "15");
        if (!expiresMinutesInput) {
            return;
        }

        try {
            const expiresMinutes = Number.parseInt(expiresMinutesInput, 10);
            await apiRequest<AccessRequest>(`/access-requests/${requestId}/approve`, {
                method: "POST",
                token: session.token,
                body: JSON.stringify({ expires_minutes: expiresMinutes }),
            });

            setPendingMessage("Request approved");
            setPendingMessageType("success");
            await Promise.all([loadPendingRequests(), loadInventory()]);
        } catch (error) {
            setPendingMessage(error instanceof Error ? error.message : "Failed to approve request");
            setPendingMessageType("error");
        }
    }

    async function revealPassword(credentialId: string): Promise<void> {
        if (!session) {
            return;
        }

        try {
            const data = await apiRequest<RevealCredentialResponse>(`/admin/credentials/${credentialId}/reveal`, {
                token: session.token,
            });
            window.alert(`DECRYPTED PASSWORD\n\nServer: ${data.server_name}\nAccount: ${data.managed_account}\n\nPassword: ${data.password}\n\nThis action has been audited.`);
        } catch (error) {
            setSetupMessage(error instanceof Error ? error.message : "Failed to reveal password");
            setSetupMessageType("error");
        }
    }

    async function denyRequest(requestId: string): Promise<void> {
        if (!session) {
            return;
        }

        const note = window.prompt("Optional deny note", "Not authorized for this task") ?? "";

        try {
            await apiRequest<AccessRequest>(`/access-requests/${requestId}/deny`, {
                method: "POST",
                token: session.token,
                body: JSON.stringify({ note }),
            });

            setPendingMessage("Request denied");
            setPendingMessageType("success");
            await loadPendingRequests();
        } catch (error) {
            setPendingMessage(error instanceof Error ? error.message : "Failed to deny request");
            setPendingMessageType("error");
        }
    }

    async function updateCredentialPassword(credentialId: string): Promise<void> {
        if (!session) {
            return;
        }

        const password = window.prompt("Enter the current password to store in the vault");
        if (!password) {
            return;
        }

        try {
            await apiRequest<Credential>(`/admin/credentials/${credentialId}/password`, {
                method: "PUT",
                token: session.token,
                body: JSON.stringify({ password }),
            });
            setSetupMessage("Tracked password updated");
            setSetupMessageType("success");
            await loadInventory();
        } catch (error) {
            setSetupMessage(error instanceof Error ? error.message : "Failed to update tracked password");
            setSetupMessageType("error");
        }
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
            await loadInventory();
        } catch (error) {
            setSetupMessage(error instanceof Error ? error.message : "Failed to create credential");
            setSetupMessageType("error");
        }
    }

    if (!session) {
        return <main className="app-shell page" />;
    }

    return (
        <main className="app-shell page">
            <AppHeader />

            <section className="grid-2">
                <article className="card">
                    <div className="card-header">
                        <h2>Pending Access Requests</h2>
                        <button type="button" onClick={() => void loadPendingRequests()}>
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
                                                <div style={{ display: "flex", gap: "0.45rem" }}>
                                                    <button type="button" className="primary" onClick={() => approveRequest(request.id)}>
                                                        Approve
                                                    </button>
                                                    <button type="button" onClick={() => denyRequest(request.id)}>
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

                    <p className={`message ${pendingMessageType}`.trim()}>{pendingMessage}</p>
                </article>

                <article className="card">
                    <h2>Platform Setup</h2>
                    <p className="lead">Register agents, servers, and tracked credentials.</p>

                    <section className="split-forms">
                        <form className="stack" onSubmit={handleCreateAgent}>
                            <h3>Create Agent</h3>
                            <label htmlFor="agent-name">
                                Name
                                <input id="agent-name" name="name" required />
                            </label>
                            <label htmlFor="agent-site">
                                Site
                                <input id="agent-site" name="site" required />
                            </label>
                            <button className="primary" type="submit">
                                Create Agent
                            </button>
                        </form>

                        <form className="stack" onSubmit={handleCreateServer}>
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
                            <button className="primary" type="submit">
                                Create Server
                            </button>
                        </form>

                        <form className="stack" onSubmit={handleCreateCredential}>
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
                            <button className="primary" type="submit">
                                Create Credential
                            </button>
                        </form>
                    </section>

                    <p className={`message ${setupMessageType}`.trim()}>{setupMessage}</p>
                </article>
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Tracked Credential Inventory</h2>
                    <button type="button" onClick={() => void loadInventory()}>
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
                                                <div style={{ display: "flex", gap: "0.45rem" }}>
                                                    <button type="button" onClick={() => revealPassword(credential.id)}>
                                                        Reveal
                                                    </button>
                                                    <button type="button" onClick={() => updateCredentialPassword(credential.id)}>
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
            </section>
        </main>
    );
}
