"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

import { IconExclamation, IconCheckCircle, IconShield } from "./Icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ConfirmDialogOption {
    label: string;
    value: string;
}

export interface ConfirmDialogField {
    name: string;
    label: string;
    type?: "text" | "password" | "number" | "textarea" | "select";
    placeholder?: string;
    required?: boolean;
    helper?: string;
    defaultValue?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: ConfirmDialogOption[];
}

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "default" | "danger" | "success";
    fields?: ConfirmDialogField[];
    busy?: boolean;
    icon?: ReactNode;
    onConfirm: (values: Record<string, string>) => void;
    onClose: () => void;
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "default",
    fields = [],
    busy = false,
    icon,
    onConfirm,
    onClose,
}: ConfirmDialogProps): JSX.Element | null {
    const getIcon = () => {
        if (icon) return icon;
        if (tone === "danger") return <IconExclamation className="icon-xl" style={{ color: "hsl(0 62% 50%)" }} />;
        if (tone === "success") return <IconCheckCircle className="icon-xl" style={{ color: "hsl(142 76% 36%)" }} />;
        return <IconShield className="icon-xl" style={{ color: "hsl(var(--primary))" }} />;
    };
    const [values, setValues] = useState<Record<string, string>>({});
    const [showValidation, setShowValidation] = useState(false);

    useEffect(() => {
        if (!open) {
            setShowValidation(false);
            return;
        }
        const initialValues: Record<string, string> = {};
        fields.forEach((field) => {
            initialValues[field.name] = field.defaultValue ?? "";
        });
        setValues(initialValues);
        setShowValidation(false);
    }, [fields, open]);

    if (!open) {
        return null;
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        void onConfirm(values);
    }

    function handleInvalid(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        setShowValidation(true);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true" aria-label={title}>
            <Card className="w-full max-w-lg">
                <form
                    onSubmit={handleSubmit}
                    onInvalidCapture={handleInvalid}
                    className="space-y-6"
                >
                    <CardHeader>
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                                tone === "danger" ? "bg-destructive/10" : tone === "success" ? "bg-green-500/10" : "bg-primary/10"
                            )}>
                                {getIcon()}
                            </div>
                            <div className="flex-1">
                                <CardTitle>{title}</CardTitle>
                                {description && (
                                    <p className="text-sm text-muted-foreground mt-2">{description}</p>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    {fields.length > 0 && (
                        <CardContent className="space-y-4">
                            {fields.map((field, index) => {
                                const value = values[field.name] ?? "";
                                
                                return (
                                    <div key={field.name} className="space-y-2">
                                        <label htmlFor={field.name} className="text-sm font-medium">
                                            {field.label}
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </label>
                                        {field.type === "textarea" ? (
                                            <textarea
                                                id={field.name}
                                                name={field.name}
                                                value={value}
                                                placeholder={field.placeholder}
                                                required={field.required}
                                                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                                autoFocus={index === 0}
                                                className="w-full min-h-[80px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        ) : field.type === "select" ? (
                                            <select
                                                id={field.name}
                                                name={field.name}
                                                value={value}
                                                required={field.required}
                                                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                                autoFocus={index === 0}
                                                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                            >
                                                {field.options?.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                type={field.type ?? "text"}
                                                value={value}
                                                placeholder={field.placeholder}
                                                required={field.required}
                                                min={field.min}
                                                max={field.max}
                                                step={field.step}
                                                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                                autoFocus={index === 0}
                                            />
                                        )}
                                        {field.helper && (
                                            <p className="text-xs text-muted-foreground">{field.helper}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    )}

                    <CardContent className="flex gap-3 pt-0">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                            {cancelLabel}
                        </Button>
                        <Button 
                            type="submit" 
                            variant={tone === "danger" ? "destructive" : "default"}
                            disabled={busy}
                            className="min-w-[120px]"
                        >
                            {busy ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                    Working…
                                </>
                            ) : confirmLabel}
                        </Button>
                    </CardContent>
                </form>
            </Card>
        </div>
    );
}
