"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "../../components/AppHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { getSession } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import type { AccessRequest, CredentialCatalogItem, RevealCredentialResponse } from "../../lib/types";

export default function EngineerPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);

    const [catalog, setCatalog] = useState<CredentialCatalogItem[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<"" | "error" | "success">("");
    const [revealedSecret, setRevealedSecret] = useState<string>("");

    const loadCatalog = useCallback(async (): Promise<void> => {
        if (!session) {
            return;
        }

        try {
            const data = await apiRequest<CredentialCatalogItem[]>("/access-requests/catalog", {
                token: session.token,
            });
            setCatalog(data);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load credential catalog");
            setMessageType("error");
        }
    }, [session]);

    const loadRequests = useCallback(async (): Promise<void> => {
        if (!session) {
            return;
        }

        try {
            const data = await apiRequest<AccessRequest[]>("/access-requests/mine", {
                token: session.token,
            });
            setRequests(data);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load requests");
            setMessageType("error");
        }
    }, [session]);

    useEffect(() => {
        if (!session) {
            router.replace("/login");
            return;
        }
        if (session.role === "admin") {
            router.replace("/admin");
            return;
        }

        void Promise.all([loadCatalog(), loadRequests()]);
    }, [loadCatalog, loadRequests, router, session]);

    async function createAccessRequest(credentialId: string): Promise<void> {
        if (!session) {
            return;
        }

        const reason = window.prompt("Reason for access request", "Troubleshooting customer issue");
        if (!reason) {
            return;
        }

        try {
            await apiRequest<AccessRequest>("/access-requests/", {
                method: "POST",
                token: session.token,
                body: JSON.stringify({ credential_id: credentialId, reason }),
            });

            setMessage("Access request submitted");
            setMessageType("success");
            await loadRequests();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to submit request");
            setMessageType("error");
        }
    }

    async function revealCredential(requestId: string): Promise<void> {
        if (!session) {
            return;
        }

        try {
            const data = await apiRequest<RevealCredentialResponse>(`/access-requests/${requestId}/reveal`, {
                method: "POST",
                token: session.token,
                body: JSON.stringify({}),
            });

            setRevealedSecret(
                `server=${data.server_name}\nmanaged_account=${data.managed_account}\nexpires=${formatDate(
                    data.expires_at,
                )}\npassword=${data.password}`,
            );
            setMessage("Password revealed from the vault for this approved request.");
            setMessageType("success");
            await loadRequests();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to reveal credential");
            setMessageType("error");
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
                        <h2>Tracked Passwords</h2>
                        <span className="chip">{session.username}</span>
                    </div>
                    <p className="lead">Request approval before revealing a tracked machine password.</p>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Server</th>
                                    <th>Site</th>
                                    <th>OS</th>
                                    <th>Account</th>
                                    <th>Version</th>
                                    <th>Last Sync</th>
                                    <th>Source</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catalog.length === 0 ? (
                                    <tr>
                                        <td colSpan={8}>No tracked credentials available.</td>
                                    </tr>
                                ) : (
                                    catalog.map((item) => (
                                        <tr key={item.credential_id}>
                                            <td>{item.server_name}</td>
                                            <td>{item.site}</td>
                                            <td>{item.os_type}</td>
                                            <td>{item.managed_account}</td>
                                            <td>{item.version}</td>
                                            <td>{formatDate(item.last_synced_at)}</td>
                                            <td>{item.last_sync_source}</td>
                                            <td>
                                                <button type="button" className="secondary" onClick={() => createAccessRequest(item.credential_id)}>
                                                    Request
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>

                <article className="card">
                    <div className="card-header">
                        <h2>My Requests</h2>
                        <button type="button" onClick={() => void loadRequests()}>
                            Refresh
                        </button>
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Expires</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>No access requests yet.</td>
                                    </tr>
                                ) : (
                                    requests.map((request) => (
                                        <tr key={request.id}>
                                            <td>{request.id}</td>
                                            <td>
                                                <StatusBadge status={request.status} />
                                            </td>
                                            <td>{formatDate(request.created_at)}</td>
                                            <td>{formatDate(request.expires_at)}</td>
                                            <td>
                                                {request.status === "approved" ? (
                                                    <button type="button" className="primary" onClick={() => revealCredential(request.id)}>
                                                        Reveal
                                                    </button>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            </section>

            <section className="card">
                <h3>Credential Output</h3>
                {revealedSecret ? <pre className="secret">{revealedSecret}</pre> : <p className="lead">No credential revealed yet.</p>}
                <p className={`message ${messageType}`.trim()}>{message}</p>
            </section>
        </main>
    );
}
