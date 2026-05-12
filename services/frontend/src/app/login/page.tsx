"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { IconKey, IconLock, IconShield } from "../../components/Icons";
import { apiRequest } from "../../lib/api";
import { getSession, setSession } from "../../lib/auth";
import type { AuthResponse } from "../../lib/types";

export default function LoginPage(): JSX.Element {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<"" | "error">("");
    const [loading, setLoading] = useState(false);
    const [showValidation, setShowValidation] = useState(false);

    useEffect(() => {
        const session = getSession();
        if (!session) return;
        router.replace(session.role === "admin" ? "/admin" : "/engineer");
    }, [router]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        event.stopPropagation();
        
        if (!username.trim() || !password.trim()) {
            setMessage("Please enter both username and password.");
            setMessageType("error");
            setShowValidation(true);
            return;
        }
        
        setLoading(true);
        setMessage("Authenticating...");
        setMessageType("");
        
        console.log("Attempting login with:", { username, password: "***" });
        
        try {
            const payload = await apiRequest<AuthResponse>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username: username.trim(), password: password.trim() }),
            });
            
            console.log("Login successful:", payload);
            
            setSession({ token: payload.access_token, role: payload.role, username: payload.username });
            setMessage("Login successful! Redirecting...");
            setMessageType("");
            
            // Small delay to show success message
            setTimeout(() => {
                router.replace(payload.role === "admin" ? "/admin" : "/engineer");
            }, 500);
            
        } catch (error) {
            console.error("Login failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Authentication failed";
            setMessage(errorMessage);
            setMessageType("error");
        } finally {
            setLoading(false);
        }
    }

    

    return (
        <div className="login-shell">
            {/* ── Left: Login Form ── */}
            <div className="login-left">
                <div className="login-box">
                    <div className="login-logo">
                        <div className="login-logo-mark">
                            <IconShield />
                        </div>
                        <div className="login-logo-text">
                            <small>Vault + Agent</small>
                            <strong>Control Plane</strong>
                        </div>
                    </div>

                    <h1 className="login-heading">Welcome back</h1>
                    <p className="login-sub">Sign in to manage credentials and access workflows.</p>

                    <form
                        className="form-stack"
                        data-validation={showValidation ? "true" : undefined}
                        onSubmit={handleSubmit}
                    >
                        <label htmlFor="login-username">
                            Username
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                autoComplete="username"
                                placeholder="e.g. admin"
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </label>
                        <label htmlFor="login-password">
                            Password
                            <input
                                id="login-password"
                                type="password"
                                value={password}
                                autoComplete="current-password"
                                placeholder="••••••••••••"
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </label>
                        <button
                            className="btn-primary"
                            style={{ width: "100%", justifyContent: "center", padding: "0.7rem 1rem", marginTop: "0.25rem" }}
                            type="submit"
                            disabled={loading}
                        >
                            <IconLock className="icon-sm" />
                            {loading ? "Signing In…" : "Sign In"}
                        </button>
                    </form>

                    {message ? (
                        <div className={`toast ${messageType}`} style={{ marginTop: "1rem" }}>
                            {message}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* ── Right: Info Panel ── */}
            <div className="login-right">
                <div className="info-card">
                    <div className="info-card-title">
                        <IconKey className="icon" style={{ color: "var(--accent)" }} />
                        Seed Accounts
                    </div>
                    <p>Use these to get started. Rotate them immediately outside local testing.</p>
                    <div className="creds-list">
                        <div className="cred-item">admin / ChangeMeStrong!</div>
                        <div className="cred-item">engineer / EngineerChangeMe!123</div>
                    </div>
                </div>

                <div className="info-card">
                    <div className="info-card-title">
                        <IconShield className="icon" style={{ color: "var(--accent)" }} />
                        Security Baseline
                    </div>
                    <div className="security-list">
                        <div className="security-item">AES-256-GCM envelope encryption for all vault passwords.</div>
                        <div className="security-item">RBAC enforced with short-lived JWT tokens.</div>
                        <div className="security-item">Agent authentication via signed bearer tokens.</div>
                        <div className="security-item">Full audit trail on approvals, reveals, and agent syncs.</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
