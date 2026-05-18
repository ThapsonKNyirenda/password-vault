"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    label?: string;
}

const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };

export function LoadingSpinner({ size = "md", className = "", label }: LoadingSpinnerProps): JSX.Element {
    return (
        <div className={cn("flex items-center gap-2", className)} role="status" aria-live="polite">
            <div className={cn(
                "animate-spin rounded-full border-2 border-muted border-t-primary",
                sizes[size]
            )} />
            {label && <span className="text-sm text-muted-foreground">{label}</span>}
        </div>
    );
}
