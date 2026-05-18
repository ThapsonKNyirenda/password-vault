"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

import { IconAlert, IconCheckCircle, IconExclamation, IconShield } from "./Icons";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastMeta = {
    success: {
        label: "Success",
        icon: IconCheckCircle,
    },
    error: {
        label: "Error",
        icon: IconExclamation,
    },
    warning: {
        label: "Warning",
        icon: IconAlert,
    },
    info: {
        label: "Info",
        icon: IconShield,
    },
} satisfies Record<ToastType, { label: string; icon: typeof IconCheckCircle }>;

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = "info") => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 4000);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <div className="toast-stack">
                {toasts.map((t) => {
                    const meta = toastMeta[t.type];
                    const ToastIcon = meta.icon;

                    return (
                        <div
                            key={t.id}
                            className={`toast-notification toast-${t.type}`}
                            role={t.type === "error" ? "alert" : "status"}
                            aria-live={t.type === "error" ? "assertive" : "polite"}
                        >
                            <span className="toast-icon" aria-hidden="true">
                                <ToastIcon className="icon-sm" />
                            </span>
                            <span className="toast-content">
                                <span className="toast-title">{meta.label}</span>
                                <span className="toast-message">{t.message}</span>
                            </span>
                            <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss notification">
                                ×
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
