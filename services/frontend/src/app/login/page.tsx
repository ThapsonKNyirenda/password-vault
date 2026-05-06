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
        if (!session) {
            return;
        }
        if (session.role === "admin") {
            router.replace("/admin");
            return;
        }
        router.replace("/engineer");
    }, [router]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setLoading(true);
        setMessage("Authenticating...");
        setMessageType("");

        try {
            const payload = await apiRequest<AuthResponse>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });

            setSession({
                token: payload.access_token,
                role: payload.role,
                username: payload.username,
            });

            if (payload.role === "admin") {
                router.replace("/admin");
            } else {
                router.replace("/engineer");
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Authentication failed");
            setMessageType("error");
        } finally {
            setLoading(false);
        }
    }

    function handleInvalid(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        setShowValidation(true);
        setMessage("Please complete the required fields.");
        setMessageType("error");
    }

    return (
        <main className="app-shell page">
            <section className="auth-grid">
                <article className="card">
                    <div className="inline-title">
                        <span className="brand-mark">
                            <IconLock />
                        </span>
                        <div>
                            <h2>Sign In</h2>
                            <p className="lead">
                                Authenticate to manage approval workflows and reveal tracked credentials.
                            </p>
                        </div>
                    </div>

                    <form
                        className="stack"
                        data-validation={showValidation ? "true" : undefined}
                        onInvalidCapture={handleInvalid}
                        onSubmit={handleSubmit}
                    >
                        <label htmlFor="username">
                            Username
                            <input
                                id="username"
                                type="text"
                                value={username}
                                autoComplete="username"
                                onChange={(event) => setUsername(event.target.value)}
                                required
                            />
                        </label>
                        <label htmlFor="password">
                            Password
                            <input
                                id="password"
                                type="password"
                                value={password}
                                autoComplete="current-password"
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                        </label>
                        <button className="btn primary" type="submit" disabled={loading}>
                            {loading ? "Signing In..." : "Sign In"}
                        </button>
                    </form>
                    {message ? <div className={`toast ${messageType}`.trim()}>{message}</div> : null}
                </article>

                <div className="stacked-cards">
                    <article className="card">
                        <div className="inline-title">
                            <IconKey />
                            <h3>Seed Accounts</h3>
                        </div>
                        <p className="lead">Rotate these credentials outside local testing.</p>
                        <div className="chip mono">admin / ChangeMeStrong!</div>
                        <div className="chip mono">engineer / EngineerChangeMe!123</div>
                    </article>

                    <article className="card">
                        <div className="inline-title">
                            <IconShield />
                            <h3>Security Baseline</h3>
                        </div>
                        <p>AES-256-GCM envelope encryption for passwords.</p>
                        <p>RBAC with JWT and agent bearer token auth.</p>
                        <p>Full audit trail on approvals, reveals, and agent syncs.</p>
                    </article>
                </div>
            </section>
        </main>
    );
}
