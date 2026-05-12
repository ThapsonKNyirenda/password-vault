"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "../../components/Sidebar";
import { ConfirmDialog, type ConfirmDialogField } from "../../components/ConfirmDialog";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
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
    { id: "catalog", label: "Servers", icon: <IconServer className="sidebar-link-icon" /> },
    { id: "reveal", label: "Credential Output", icon: <IconLock className="sidebar-link-icon" /> },
];

export default function EngineerPage(): JSX.Element {
    const router = useRouter();
    const session = useMemo(() => getSession(), []);

    const [activeTab, setActiveTab] = useState("catalog");
    const [catalog, setCatalog] = useState<CredentialCatalogItem[]>([]);
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

    useEffect(() => {
        if (!session) { router.replace("/login"); return; }
        if (session.role === "admin") { router.replace("/admin"); return; }
        void loadCatalog();
    }, [loadCatalog, router, session]);

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
                            label="Total Credentials"
                            value={catalog.length}
                            icon={<IconKey className="icon-lg" />}
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
                        <StatCard
                            label="Available Servers"
                            value={catalog.length}
                            variant="accent"
                            icon={<IconServer className="icon-lg" />}
                        />
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {TABS.map((t) => (
                                        <Button key={t.id} variant={activeTab === t.id ? "default" : "ghost"} onClick={() => setActiveTab(t.id)}>
                                            {t.icon} {t.label}
                                        </Button>
                                    ))}
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => {
                                    if (activeTab === 'catalog') loadCatalog();
                                }}>
                                    <IconRefresh className="w-4 h-4 mr-2" /> Refresh
                                </Button>
                            </div>
                        </CardHeader>

                        {activeTab === "catalog" && (
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Server</TableHead>
                                            <TableHead>Site</TableHead>
                                            <TableHead>OS</TableHead>
                                            <TableHead>Account</TableHead>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Last Sync</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {catalog.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                                    No tracked credentials available.
                                                </TableCell>
                                            </TableRow>
                                        ) : catalog.map((item) => (
                                            <TableRow key={item.credential_id}>
                                                <TableCell className="font-medium">{item.server_name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{item.site}</Badge>
                                                </TableCell>
                                                <TableCell>{item.os_type}</TableCell>
                                                <TableCell>{item.managed_account}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">v{item.version}</Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{formatDate(item.last_synced_at)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="default">{item.last_sync_source}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" onClick={() => openDirectReveal(item)}>
                                                        <IconEye className="w-4 h-4 mr-2" /> Reveal
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        )}

                        {activeTab === "reveal" && (
                            <CardContent>
                                {revealData ? (
                                    <div className="space-y-4">
                                        <pre className="p-4 bg-muted rounded-md text-sm text-muted-foreground">{revealPayload}</pre>
                                        <div className="flex items-center justify-between text-sm">
                                            <Badge variant="outline">{revealData.server_name} - {revealData.managed_account}</Badge>
                                            {countdown && <Badge variant="destructive">{countdown}</Badge>}
                                            {revealExpiresAt && <span className="text-muted-foreground">Expires {formatDate(revealExpiresAt.toISOString())}</span>}
                                            <Button variant="ghost" size="sm" onClick={() => { setRevealData(null); setRevealExpiresAt(null); setCountdown(""); }}>
                                                Hide now
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-md">
                                        <p className="text-muted-foreground">
                                            No credential revealed yet. Go to <strong>Credentials</strong> and click Reveal.
                                        </p>
                                    </div>
                                )}
                                {message && <div className={`p-4 rounded-md mt-4 text-sm ${messageType === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{message}</div>}
                            </CardContent>
                        )}
                    </Card>
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
