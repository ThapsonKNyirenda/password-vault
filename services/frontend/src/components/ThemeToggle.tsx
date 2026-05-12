"use client";

import { useEffect, useState } from "react";

import { applyTheme, getPreferredTheme, getStoredTheme, setStoredTheme, type ThemeMode } from "../lib/theme";
import { IconMoon, IconSun } from "./Icons";

export function ThemeToggle(): JSX.Element {
    const [theme, setTheme] = useState<ThemeMode>("dark");

    useEffect(() => {
        const nextTheme = getStoredTheme() ?? getPreferredTheme();
        setTheme(nextTheme);
        applyTheme(nextTheme);
    }, []);

    function handleToggle(): void {
        const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        setStoredTheme(nextTheme);
    }

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={handleToggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
            <span className="theme-toggle-track">
                <span className="theme-toggle-thumb">
                    {theme === "dark" ? <IconMoon className="icon-sm" /> : <IconSun className="icon-sm" />}
                </span>
            </span>
            <span className="theme-toggle-label">{theme === "dark" ? "Dark" : "Light"}</span>
        </button>
    );
}
