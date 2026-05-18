"use client";

import { useRouter } from "next/navigation";

import { clearSession } from "../lib/auth";
import { IconLogout } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

export function HeaderActions(): JSX.Element {
    const router = useRouter();

    function handleLogout(): void {
        clearSession();
        router.replace("/login");
    }

    return (
        <div className="header-actions">
            <ThemeToggle showLabel={false} />
            <button type="button" className="header-icon-btn" onClick={handleLogout} aria-label="Sign out" title="Sign out">
                <IconLogout className="icon-sm" />
            </button>
        </div>
    );
}
