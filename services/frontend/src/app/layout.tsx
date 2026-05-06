import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Credential Control Plane",
    description: "Vault + Local Agent password tracking and approved reveal workflows",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${jetbrainsMono.variable}`}>{children}</body>
        </html>
    );
}
