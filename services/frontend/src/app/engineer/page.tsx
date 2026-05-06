"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "../../components/AppHeader";
import { ConfirmDialog, type ConfirmDialogField } from "../../components/ConfirmDialog";
import { IconEye, IconRefresh } from "../../components/Icons";
import { StatusBadge } from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { getSession } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import type { AccessRequest, CredentialCatalogItem, RevealCredentialResponse } from "../../lib/types";

interface DialogState {
    title: string;
    description?: string;
    confirmLabel?: string;
    tone?: "default" | "danger";
    fields?: ConfirmDialogField[];
    onConfirm: (values: Record<string, string>) => Promise<boolean | void>;
}

function formatCountdown(msRemaining: number): string {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function EngineerPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);

    const [catalog, setCatalog] = useState<CredentialCatalogItem[]>([]);
    const [activity, setActivity] = useState<AccessRequest[]>([]);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<"" | "error" | "success">("");
    const [revealData, setRevealData] = useState<RevealCredentialResponse | null>(null);
    const [revealExpiresAt, setRevealExpiresAt] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState("");
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [dialogBusy, setDialogBusy] = useState(false);

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

    const loadActivity = useCallback(async (): Promise<void> => {
        if (!session) {
            return;
        }

        try {
            const data = await apiRequest<AccessRequest[]>("/access-requests/mine", {
                token: session.token,
            });
            setActivity(data);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load activity");
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

        void Promise.all([loadCatalog(), loadActivity()]);
    }, [loadCatalog, loadActivity, router, session]);

    const latestSync = useMemo(() => {
        const dates = catalog
            .map((item) => new Date(item.last_synced_at))
            .filter((value) => !Number.isNaN(value.getTime()));
        if (dates.length === 0) {
            return "-";
        }
        dates.sort((a, b) => b.getTime() - a.getTime());
        return dates[0].toLocaleString();
    }, [catalog]);

    useEffect(() => {
        if (!revealExpiresAt) {
            setCountdown("");
            return;
        }

        const updateCountdown = () => {
            const remaining = revealExpiresAt.getTime() - Date.now();
            if (remaining <= 0) {
                setRevealData(null);
                setRevealExpiresAt(null);
                setCountdown("");
                setMessage("Reveal window expired. Reveal again if needed.");
                setMessageType("");
                return;
            }
            setCountdown(formatCountdown(remaining));
        };

        updateCountdown();
        const timer = window.setInterval(updateCountdown, 1000);
        return () => window.clearInterval(timer);
    }, [revealExpiresAt]);

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

    function openDirectReveal(item: CredentialCatalogItem): void {
        if (!session) {
            return;
        }

        setDialog({
            title: "Direct reveal",
            description: `Reveal ${item.managed_account} on ${item.server_name} for a 5-minute window.`,
            confirmLabel: "Reveal for 5 minutes",
            tone: "danger",
            onConfirm: async () => {
                try {
                    const data = await apiRequest<RevealCredentialResponse>("/access-requests/direct-reveal", {
                        method: "POST",
                        token: session.token,
                        body: JSON.stringify({ credential_id: item.credential_id }),
                    });

                    const expiresAt = data.expires_at
                        ? new Date(data.expires_at)
                        : new Date(Date.now() + 5 * 60 * 1000);

                    setRevealData(data);
                    setRevealExpiresAt(expiresAt);
                    setMessage("Credential revealed. Auto-hide engaged for 5 minutes.");
                    setMessageType("success");
                    await loadActivity();
                    return true;
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed to reveal credential");
                    setMessageType("error");
                    return false;
                }
            },
        });
    }

    function clearReveal(): void {
        setRevealData(null);
        setRevealExpiresAt(null);
        setCountdown("");
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
                    <h3>{catalog.length}</h3>
                    <p>Tracked Credentials</p>
                </div>
                <div className="stat-card">
                    <h3>{activity.length}</h3>
                    <p>Recent Access Events</p>
                </div>
                <div className="stat-card">
                    <h3>{latestSync}</h3>
                    <p>Last Sync</p>
                </div>
                <div className="stat-card">
                    <h3>{revealData ? "Active" : "Idle"}</h3>
                    <p>Reveal Window</p>
                </div>
            </section>

            <section className="grid-2">
                <article className="card">
                    <div className="card-header">
                        <div>
                            <h2>Tracked Passwords</h2>
                            <p className="lead">Direct reveal grants a 5-minute access window.</p>
                        </div>
                        <div className="table-actions">
                            <span className="chip mono">{session.username}</span>
                            <button type="button" className="btn ghost" onClick={() => void loadCatalog()}>
                                <IconRefresh />
                                Refresh
                            </button>
                        </div>
                    </div>

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
                                                <button type="button" className="btn primary" onClick={() => openDirectReveal(item)}>
                                                    <IconEye />
                                                    Reveal
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
                        <div>
                            <h2>Recent Activity</h2>
                            <p className="lead">Audit trail for your direct reveals.</p>
                        </div>
                        <button type="button" className="btn ghost" onClick={() => void loadActivity()}>
                            <IconRefresh />
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
                                    <th>Revealed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activity.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>No access activity yet.</td>
                                    </tr>
                                ) : (
                                    activity.map((request) => (
                                        <tr key={request.id}>
                                            <td>{request.id}</td>
                                            <td>
                                                <StatusBadge status={request.status} />
                                            </td>
                                            <td>{formatDate(request.created_at)}</td>
                                            <td>{formatDate(request.expires_at)}</td>
                                            <td>{formatDate(request.revealed_at)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            </section>

            <section className="card">
                <div className="card-header">
                    <div>
                        <h3>Credential Output</h3>
                        <p className="lead">Sensitive values expire automatically.</p>
                    </div>
                    {revealData ? (
                        <button type="button" className="btn ghost" onClick={clearReveal}>
                            Hide now
                        </button>
                    ) : null}
                </div>
                {revealData ? (
                    <>
                        <pre className="secret">{revealPayload}</pre>
                        <div className="secret-meta">
                            <span className="chip mono">{revealData.credential_id}</span>
                            {countdown ? <span className="countdown">{countdown}</span> : null}
                            {revealExpiresAt ? <span>Expires {formatDate(revealExpiresAt.toISOString())}</span> : null}
                        </div>
                    </>
                ) : (
                    <p className="lead">No credential revealed yet.</p>
                )}
                {message ? <div className={`toast ${messageType}`.trim()}>{message}</div> : null}
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
