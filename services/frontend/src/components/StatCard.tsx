"use client";

import type { ReactNode } from "react";

interface StatCardProps {
    label: string;
    value: string | number;
    sub?: string;
    variant?: "default" | "accent" | "success" | "warning";
    icon?: ReactNode;
}

export function StatCard({ label, value, sub, variant = "default", icon }: StatCardProps): JSX.Element {
    const valueClass = variant === "default" ? "" : ` ${variant}`;
    
    return (
        <div className="stat-card">
            {icon && <div className="stat-icon">{icon}</div>}
            <div className="stat-label">{label}</div>
            <div className={`stat-value${valueClass}`}>{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    );
}
