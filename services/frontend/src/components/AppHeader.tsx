"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

import { clearSession, getSession } from "../lib/auth";
import { IconLogout, IconUser } from "./Icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
                <div className="brand-mark">
                    <Image src="/brand/mitra-logo-mark.svg" alt="Mitra" width={34} height={34} />
                </div>
                <div>
                    <h1>
                        <span>Mitra</span>
                        <span>Password Vault</span>
                    </h1>
                </div>
            </div>
            <div className="user-controls">
                <nav className="nav">
                    <Link href="/engineer" className={`nav-link ${pathname === "/engineer" ? "active" : ""}`}>
                        Engineer
                    </Link>
                    <Link href="/admin" className={`nav-link ${pathname === "/admin" ? "active" : ""}`}>
                        Admin
                    </Link>
                </nav>
                {session ? (
                    <span className="chip">
                        <IconUser />
                        {session.username}
                    </span>
                ) : null}
                {session ? <span className="chip soft">{session.role}</span> : null}
                {session ? (
                    <button type="button" className="btn ghost" onClick={handleLogout}>
                        <IconLogout />
                        Logout
                    </button>
                ) : null}
            </div>
        </header>
    );
}
