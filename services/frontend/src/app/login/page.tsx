"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { IconEye, IconLock } from "../../components/Icons";
import { ThemeToggle } from "../../components/ThemeToggle";
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
    const [showPassword, setShowPassword] = useState(false);

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

        try {
            const payload = await apiRequest<AuthResponse>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username: username.trim(), password: password.trim() }),
            });

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
            <div className="login-left">
                <div className="login-theme">
                    <ThemeToggle />
                </div>
                <div className="login-box">
                    <div className="login-logo">
                        <div className="login-logo-mark">
                            <Image src="/brand/mitra-logo.png" alt="Mitra Systems" width={190} height={80} priority />
                        </div>
                    </div>

                    <h1 className="login-heading">Welcome back</h1>
                    <p className="login-sub">Sign in to manage server credentials with ease.</p>

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
                                placeholder="Username"
                                onChange={(e) => {
                                    setUsername(e.target.value);
                                    if (showValidation) setShowValidation(false);
                                }}
                                required
                            />
                        </label>
                        <label htmlFor="login-password">
                            Password
                            <span className="password-field">
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    autoComplete="current-password"
                                    placeholder="Password"
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (showValidation) setShowValidation(false);
                                    }}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword((current) => !current)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    <IconEye className="icon-sm" />
                                </button>
                            </span>
                        </label>
                        <button
                            className="btn-primary"
                            type="submit"
                            disabled={loading}
                        >
                            <IconLock className="icon-sm" />
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    {message ? (
                        <div className={`toast ${messageType}`} role={messageType === "error" ? "alert" : "status"}>
                            {message}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
