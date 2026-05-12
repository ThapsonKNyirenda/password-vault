"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
    return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                {icon && (
                    <div className="w-16 h-16 text-muted-foreground mb-4 flex items-center justify-center">
                        {icon}
                    </div>
                )}
                <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                {description && (
                    <p className="text-sm text-muted-foreground mb-6 max-w-md">{description}</p>
                )}
                {action && <div>{action}</div>}
            </CardContent>
        </Card>
    );
}
