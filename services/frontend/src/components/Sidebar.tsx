"use client";

import { useRouter } from "next/navigation";

import { clearSession } from "../lib/auth";
import { IconLogout, IconShield } from "./Icons";

interface SidebarProps {
    username: string;
    role: string;
    activeTab: string;
    tabs: Array<{ id: string; label: string; icon: React.ReactNode }>;
    onTabChange: (id: string) => void;
}

export function Sidebar({ username, role, activeTab, tabs, onTabChange }: SidebarProps): JSX.Element {
    const router = useRouter();

    function handleLogout(): void {
        clearSession();
        router.replace("/login");
    }

    const initials = username.slice(0, 2).toUpperCase();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-mark">
                    <IconShield className="icon-md" />
                </div>
                <div className="sidebar-logo-text">
                    <small>Vault + Agent</small>
                    <strong>Control Plane</strong>
                </div>
            </div>

            <nav className="sidebar-nav">
                <span className="sidebar-section-label">Navigation</span>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`sidebar-link ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        <span className="sidebar-link-icon">{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
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
    );
}
