import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "../components/ToastProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
    title: "Mitra Password Vault",
    description: "Mitra Password Vault server credential tracking and access workflows",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
    const themeScript = `
        (() => {
            try {
                const stored = localStorage.getItem("vault_theme");
                const theme = stored === "light" || stored === "dark"
                    ? stored
                    : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                document.documentElement.classList.toggle("dark", theme === "dark");
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme;
            } catch {
                document.documentElement.classList.add("dark");
                document.documentElement.dataset.theme = "dark";
            }
        })();
    `;

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} bg-background text-foreground antialiased`}>
                <ToastProvider>{children}</ToastProvider>
            </body>
        </html>
    );
}
