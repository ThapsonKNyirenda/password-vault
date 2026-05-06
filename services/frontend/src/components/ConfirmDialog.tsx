"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";

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
    tone?: "default" | "danger";
    fields?: ConfirmDialogField[];
    busy?: boolean;
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
    onConfirm,
    onClose,
}: ConfirmDialogProps): JSX.Element | null {
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
            <form
                className="modal"
                data-validation={showValidation ? "true" : undefined}
                onInvalidCapture={handleInvalid}
                onSubmit={handleSubmit}
            >
                <div className="modal-header">
                    <div>
                        <h3>{title}</h3>
                        {description ? <p className="lead">{description}</p> : null}
                    </div>
                </div>

                {fields.length > 0 ? (
                    <div className="modal-fields">
                        {fields.map((field, index) => {
                            const value = values[field.name] ?? "";
                            const sharedProps = {
                                id: field.name,
                                name: field.name,
                                value,
                                placeholder: field.placeholder,
                                required: field.required,
                                onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                                    setValues((prev) => ({ ...prev, [field.name]: event.target.value })),
                                autoFocus: index === 0,
                            };

                            return (
                                <label key={field.name} htmlFor={field.name}>
                                    {field.label}
                                    {field.type === "textarea" ? (
                                        <textarea {...sharedProps} />
                                    ) : field.type === "select" ? (
                                        <select {...sharedProps}>
                                            {field.options?.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            {...sharedProps}
                                            type={field.type ?? "text"}
                                            min={field.min}
                                            max={field.max}
                                            step={field.step}
                                        />
                                    )}
                                    {field.helper ? <span className="field-help">{field.helper}</span> : null}
                                </label>
                            );
                        })}
                    </div>
                ) : null}

                <div className="modal-actions">
                    <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
                        {cancelLabel}
                    </button>
                    <button type="submit" className={`btn ${tone === "danger" ? "danger" : "primary"}`} disabled={busy}>
                        {busy ? "Working..." : confirmLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}
