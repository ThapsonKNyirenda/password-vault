"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { clearSession, getSession } from "../lib/auth";
import type { AuthSession } from "../lib/auth";
import { IconChevronDown, IconLogout, IconUser } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

export function HeaderActions(): JSX.Element {
    const router = useRouter();
    const [session, setSession] = useState<AuthSession | null>(null);
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setSession(getSession());
    }, []);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent): void {
            if (!menuRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") setOpen(false);
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    function handleLogout(): void {
        clearSession();
        router.replace("/login");
    }

    return (
        <div className="header-actions account-menu" ref={menuRef}>
            <button
                type="button"
                className="account-menu-trigger"
                onClick={() => setOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <span className="account-avatar">
                    <IconUser className="icon-sm" />
                </span>
                <span className="account-summary">
                    <span className="account-name">{session?.username ?? "Account"}</span>
                    <span className="account-role">{session?.role ?? "Signed in"}</span>
                </span>
                <IconChevronDown className={`account-chevron ${open ? "open" : ""}`} />
            </button>

            {open ? (
                <div className="account-menu-panel" role="menu">
                    <div className="account-menu-header">
                        <span className="account-avatar large">
                            <IconUser className="icon-md" />
                        </span>
                        <div>
                            <div className="account-name">{session?.username ?? "Account"}</div>
                            <div className="account-role">{session?.role ?? "Signed in"}</div>
                        </div>
                    </div>

                    <div className="account-menu-section">
                        <ThemeToggle />
                    </div>

                    <button type="button" className="account-menu-item danger" onClick={handleLogout} role="menuitem">
                        <IconLogout className="icon-sm" />
                        <span>Logout</span>
                    </button>
                </div>
            ) : null}
        </div>
    );
}
