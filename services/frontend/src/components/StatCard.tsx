"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: string | number;
    sub?: string;
    variant?: "default" | "accent" | "success" | "warning";
    icon?: ReactNode;
}

export function StatCard({ label, value, sub, variant = "default", icon }: StatCardProps): JSX.Element {
    const getValueClass = () => {
        switch (variant) {
            case "accent": return "stat-value accent";
            case "success": return "stat-value success";
            case "warning": return "stat-value warning";
            default: return "stat-value";
        }
    };
    
    return (
        <div className="stat-card">
            {icon && <div className="stat-icon">{icon}</div>}
            <div className="stat-label">{label}</div>
            <div className={getValueClass()}>{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    );
}
