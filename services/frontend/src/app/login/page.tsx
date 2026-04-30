"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

    return (
        <main className="app-shell page">
            <section className="card">
                <h2>Sign In</h2>
                <p className="lead">
                    Authenticate to request tracked machine passwords or manage approval workflows.
                </p>

                <form className="stack" onSubmit={handleSubmit}>
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
                    <button className="primary" type="submit" disabled={loading}>
                        {loading ? "Signing In..." : "Sign In"}
                    </button>
                    <p className={`message ${messageType}`.trim()}>{message}</p>
                </form>
            </section>

            <section className="grid-2">
                <article className="card">
                    <h3>Seed Accounts</h3>
                    <p className="lead">Change these passwords outside local testing.</p>
                    <p>admin / ChangeMeStrong!</p>
                    <p>engineer / EngineerChangeMe!123</p>
                    <p>auditor / AuditorChangeMe!123</p>
                </article>

                <article className="card">
                    <h3>Security Baseline</h3>
                    <p>AES-256-GCM envelope encryption for passwords.</p>
                    <p>RBAC with JWT and agent bearer token auth.</p>
                    <p>Full audit trail on access approvals, password syncs, and agent actions.</p>
                </article>
            </section>
        </main>
    );
}
