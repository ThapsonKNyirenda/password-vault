"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { clearSession } from "../lib/auth";
import { IconLogout, IconMenu, IconVaultPrism, IconX } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

interface SidebarProps {
    username: string;
    role: string;
    activeTab: string;
    tabs: Array<{ id: string; label: string; icon: React.ReactNode }>;
    onTabChange: (id: string) => void;
}

export function Sidebar({ username, role, activeTab, tabs, onTabChange }: SidebarProps): JSX.Element {
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close mobile sidebar on route change / tab click
    useEffect(() => {
        setMobileOpen(false);
    }, [activeTab]);

    function handleLogout(): void {
        clearSession();
        router.replace("/login");
    }

    function handleTabClick(id: string): void {
        onTabChange(id);
        setMobileOpen(false);
    }

    const initials = username.slice(0, 2).toUpperCase();

    return (
        <>
            {/* Mobile toggle */}
            <button
                type="button"
                className="mobile-menu-toggle"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
            >
                {mobileOpen ? <IconX className="icon-md" /> : <IconMenu className="icon-md" />}
            </button>

            {/* Mobile overlay */}
            {mobileOpen ? (
                <div className="mobile-sidebar-overlay" onClick={() => setMobileOpen(false)} />
            ) : null}

            <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-mark">
                        <IconVaultPrism className="icon-md" />
                    </div>
                    <div className="sidebar-logo-text">
                        <small>Prism Vault</small>
                        <strong>Access Fabric</strong>
                    </div>
                    <button
                        type="button"
                        className="mobile-close"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close menu"
                    >
                        <IconX className="icon-sm" />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <span className="sidebar-section-label">Navigation</span>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`sidebar-link ${activeTab === tab.id ? "active" : ""}`}
                            onClick={() => handleTabClick(tab.id)}
                        >
                            <span className="sidebar-link-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <ThemeToggle />
                    <div className="sidebar-user" title={`${username} (${role})`}>
                        <div className="sidebar-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <span>{username}</span>
                            <small>{role}</small>
                        </div>
                    </div>
                    <button type="button" className="logout-btn" onClick={handleLogout}>
                        <IconLogout className="icon-sm" />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
