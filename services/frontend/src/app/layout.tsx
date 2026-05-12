import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
    title: "Credential Control Plane",
    description: "Vault + Local Agent password tracking and approved reveal workflows",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <html lang="en" suppressHydrationWarning className={cn("font-mono", jetbrainsMono.variable)}>
            <body className={`${inter.variable} ${jetbrainsMono.variable} bg-background text-foreground antialiased`}>
                {children}
            </body>
        </html>
    );
}
