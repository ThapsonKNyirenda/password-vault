"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "../../components/Sidebar";
import { ConfirmDialog, type ConfirmDialogField } from "../../components/ConfirmDialog";
import { 
    IconEye, IconKey, IconRefresh, IconShield, IconClock,
    IconCheckCircle, IconActivity, IconServer, IconLock
} from "../../components/Icons";
import { StatCard } from "../../components/StatCard";
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

const TABS = [
    { id: "catalog",  label: "Credentials",    icon: <IconServer className="sidebar-link-icon" /> },
    { id: "activity", label: "Recent Activity", icon: <IconActivity className="sidebar-link-icon" /> },
    { id: "reveal",   label: "Credential Output", icon: <IconLock className="sidebar-link-icon" /> },
];

export default function EngineerPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);

    const [activeTab, setActiveTab] = useState("catalog");
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
        if (!session) return;
        try {
            setCatalog(await apiRequest<CredentialCatalogItem[]>("/access-requests/catalog", { token: session.token }));
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load catalog");
            setMessageType("error");
        }
    }, [session]);

    const loadActivity = useCallback(async (): Promise<void> => {
        if (!session) return;
        try {
            setActivity(await apiRequest<AccessRequest[]>("/access-requests/mine", { token: session.token }));
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load activity");
            setMessageType("error");
        }
    }, [session]);

    useEffect(() => {
        if (!session) { router.replace("/login"); return; }
        if (session.role === "admin") { router.replace("/admin"); return; }
        void Promise.all([loadCatalog(), loadActivity()]);
    }, [loadCatalog, loadActivity, router, session]);

    const latestSync = useMemo(() => {
        const dates = catalog.map((i) => new Date(i.last_synced_at)).filter((d) => !Number.isNaN(d.getTime()));
        if (dates.length === 0) return "—";
        dates.sort((a, b) => b.getTime() - a.getTime());
        return dates[0].toLocaleString();
    }, [catalog]);

    useEffect(() => {
        if (!revealExpiresAt) { setCountdown(""); return; }
        const tick = () => {
            const remaining = revealExpiresAt.getTime() - Date.now();
            if (remaining <= 0) {
                setRevealData(null); setRevealExpiresAt(null); setCountdown("");
                setMessage("Reveal window expired."); setMessageType("");
                return;
            }
            setCountdown(formatCountdown(remaining));
        };
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [revealExpiresAt]);

    async function handleDialogConfirm(values: Record<string, string>): Promise<void> {
        if (!dialog) return;
        setDialogBusy(true);
        try {
            const ok = await dialog.onConfirm(values);
            if (ok !== false) setDialog(null);
        } finally { setDialogBusy(false); }
    }

    function openDirectReveal(item: CredentialCatalogItem): void {
        if (!session) return;
        setDialog({
            title: "Reveal credential",
            description: `Reveal ${item.managed_account} on ${item.server_name} for a 5-minute window.`,
            confirmLabel: "Reveal for 5 minutes",
            tone: "danger",
            onConfirm: async () => {
                try {
                    const data = await apiRequest<RevealCredentialResponse>("/access-requests/direct-reveal", {
                        method: "POST", token: session.token,
                        body: JSON.stringify({ credential_id: item.credential_id }),
                    });
                    setRevealData(data);
                    setRevealExpiresAt(data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 5 * 60 * 1000));
                    setMessage("Credential revealed. Auto-hide in 5 minutes."); setMessageType("success");
                    setActiveTab("reveal");
                    await loadActivity();
                    return true;
                } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Failed to reveal"); setMessageType("error");
                    return false;
                }
            },
        });
    }

    if (!session) return <div className="layout" />;

    const revealPayload = revealData
        ? `server=${revealData.server_name}\nmanaged_account=${revealData.managed_account}\npassword=${revealData.password}`
        : "";

    return (
        <div className="layout">
            <Sidebar
                username={session.username}
                role={session.role}
                activeTab={activeTab}
                tabs={TABS}
                onTabChange={setActiveTab}
            />

            <main className="main-content">
                <div className="page-shell">
                    {/* Stats */}
                    <div className="stats-grid">
                        <StatCard 
                            label="Tracked Credentials" 
                            value={catalog.length}
                            variant="accent"
                            icon={<IconServer className="icon-lg" />}
                        />
                        <StatCard 
                            label="Access Events" 
                            value={activity.length}
                            icon={<IconActivity className="icon-lg" />}
                        />
                        <StatCard 
                            label="Last Sync" 
                            value={latestSync}
                            sub="Latest agent synchronization"
                            icon={<IconClock className="icon-lg" />}
                        />
                        <StatCard 
                            label="Reveal Window" 
                            value={revealData ? "Active" : "Idle"}
                            variant={revealData ? "success" : "default"}
                            sub={countdown ? `${countdown} remaining` : undefined}
                            icon={revealData ? <IconCheckCircle className="icon-lg" /> : <IconLock className="icon-lg" />}
                        />
                    </div>

                    {/* Tabs */}
                    <div className="card">
                        <div className="tabs">
                            {TABS.map((t) => (
                                <button key={t.id} type="button" className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Catalog */}
                        {activeTab === "catalog" && (
                            <>
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Tracked Passwords</div>
                                        <div className="card-desc">Direct reveal grants a 5-minute access window.</div>
                                    </div>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadCatalog()}>
                                        <IconRefresh className="icon-sm" /> Refresh
                                    </button>
                                </div>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Server</th><th>Site</th><th>OS</th>
                                                <th>Account</th><th>Version</th><th>Last Sync</th><th>Source</th><th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {catalog.length === 0 ? (
                                                <tr className="empty-row"><td colSpan={8}>No tracked credentials available.</td></tr>
                                            ) : catalog.map((item) => (
                                                <tr key={item.credential_id}>
                                                    <td><strong>{item.server_name}</strong></td>
                                                    <td><span className="mono-tag">{item.site}</span></td>
                                                    <td>{item.os_type}</td>
                                                    <td>{item.managed_account}</td>
                                                    <td><span className="badge badge-neutral">v{item.version}</span></td>
                                                    <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{formatDate(item.last_synced_at)}</td>
                                                    <td><span className="badge badge-info">{item.last_sync_source}</span></td>
                                                    <td>
                                                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openDirectReveal(item)}>
                                                            <IconEye className="icon-sm" /> Reveal
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* Activity */}
                        {activeTab === "activity" && (
                            <>
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Recent Activity</div>
                                        <div className="card-desc">Audit trail for your direct reveals.</div>
                                    </div>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadActivity()}>
                                        <IconRefresh className="icon-sm" /> Refresh
                                    </button>
                                </div>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr><th>ID</th><th>Status</th><th>Created</th><th>Expires</th><th>Revealed</th></tr>
                                        </thead>
                                        <tbody>
                                            {activity.length === 0 ? (
                                                <tr className="empty-row"><td colSpan={5}>No access activity yet.</td></tr>
                                            ) : activity.map((req) => (
                                                <tr key={req.id}>
                                                    <td><span className="mono-tag">{req.id.slice(0, 8)}…</span></td>
                                                    <td><StatusBadge status={req.status} /></td>
                                                    <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{formatDate(req.created_at)}</td>
                                                    <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{formatDate(req.expires_at)}</td>
                                                    <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{formatDate(req.revealed_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* Reveal Output */}
                        {activeTab === "reveal" && (
                            <>
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">Credential Output</div>
                                        <div className="card-desc">Sensitive values expire automatically.</div>
                                    </div>
                                    {revealData ? (
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRevealData(null); setRevealExpiresAt(null); setCountdown(""); }}>
                                            Hide now
                                        </button>
                                    ) : null}
                                </div>
                                <div className="card-body">
                                    {revealData ? (
                                        <>
                                            <pre className="secret">{revealPayload}</pre>
                                            <div className="secret-meta">
                                                <span className="mono-tag">{revealData.credential_id}</span>
                                                {countdown ? <span className="countdown">{countdown}</span> : null}
                                                {revealExpiresAt ? <span>Expires {formatDate(revealExpiresAt.toISOString())}</span> : null}
                                            </div>
                                        </>
                                    ) : (
                                        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: "2rem" }}>
                                            No credential revealed yet. Go to <strong>Credentials</strong> and click Reveal.
                                        </p>
                                    )}
                                    {message ? <div className={`toast ${messageType}`}>{message}</div> : null}
                                </div>
                            </>
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
