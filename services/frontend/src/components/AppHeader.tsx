"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearSession, getSession } from "../lib/auth";

export function AppHeader(): JSX.Element {
    const pathname = usePathname();
    const router = useRouter();
    const session = getSession();

    function handleLogout(): void {
        clearSession();
        router.replace("/login");
    }

    return (
        <header className="topbar">
            <div className="brand">
                <small>Vault + Agent</small>
                <h1>Credential Control Plane</h1>
            </div>
            <nav className="nav">
                <Link href="/engineer" className={pathname === "/engineer" ? "chip" : ""}>
                    Engineer
                </Link>
                <Link href="/admin" className={pathname === "/admin" ? "chip" : ""}>
                    Admin
                </Link>
                {session ? <span className="chip">{session.username}</span> : null}
                {session ? (
                    <button type="button" onClick={handleLogout}>
                        Logout
                    </button>
                ) : null}
            </nav>
        </header>
    );
}
