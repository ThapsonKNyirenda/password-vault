import type { SVGProps } from "react";

function combineClassName(...values: Array<string | undefined>): string {
    return values.filter(Boolean).join(" ");
}

const baseProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
    "aria-hidden": true,
};

export function IconShield({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M12 3l7 3v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3z" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    );
}

export function IconVaultPrism({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M12 2.8 20 7v6.2c0 4.4-3.2 7.3-8 8-4.8-.7-8-3.6-8-8V7l8-4.2z" />
            <path d="M8.2 8.7 12 6.8l3.8 1.9v4.1L12 15l-3.8-2.2V8.7z" />
            <path d="M12 6.8V15" />
            <path d="m8.2 8.7 3.8 2 3.8-2" />
        </svg>
    );
}

export function IconSun({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
        </svg>
    );
}

export function IconMoon({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7 7 0 1 0 20.5 14.5z" />
        </svg>
    );
}

export function IconLock({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            <path d="M12 15v2" />
        </svg>
    );
}

export function IconKey({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M15 7a4 4 0 1 1-7.5 2H3v4h4v-2h2v-2h2" />
            <circle cx="15" cy="7" r="2" />
        </svg>
    );
}

export function IconEye({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

export function IconEdit({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M4 17.25V20h2.75L18 8.75l-2.75-2.75L4 17.25z" />
            <path d="M14.5 6.25l2.75 2.75" />
        </svg>
    );
}

export function IconTrash({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M5 7h14" />
            <path d="M9 7V5h6v2" />
            <path d="M7 7l1 12h8l1-12" />
        </svg>
    );
}

export function IconRestore({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
        </svg>
    );
}

export function IconUser({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
    );
}

export function IconAlert({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M12 3l9 16H3l9-16z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </svg>
    );
}

export function IconRefresh({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M20 6v6h-6" />
            <path d="M4 18v-6h6" />
            <path d="M6.5 7.5a7 7 0 0 1 11 2" />
            <path d="M17.5 16.5a7 7 0 0 1-11-2" />
        </svg>
    );
}

export function IconLogout({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M10 17l-1 3h10V4H9l1 3" />
            <path d="M3 12h11" />
            <path d="M8 7l5 5-5 5" />
        </svg>
    );
}

export function IconDashboard({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
    );
}

export function IconServer({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <rect x="2" y="2" width="20" height="8" rx="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" />
            <circle cx="6" cy="6" r="1.5" />
            <circle cx="6" cy="18" r="1.5" />
        </svg>
    );
}

export function IconClock({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
        </svg>
    );
}

export function IconCheckCircle({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    );
}

export function IconExclamation({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 17h.01" />
        </svg>
    );
}

export function IconDocument({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            <path d="M14 4v6h6" />
        </svg>
    );
}

export function IconSettings({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}

export function IconSearch({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
        </svg>
    );
}

export function IconChevronRight({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M9 18l6-6-6-6" />
        </svg>
    );
}

export function IconChevronDown({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export function IconInbox({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M22 12h-6l-2 3h-8l-2-3H2" />
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
    );
}

export function IconActivity({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    );
}

export function IconX({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
        </svg>
    );
}

export function IconMenu({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg {...baseProps} className={combineClassName("icon", className)} {...props}>
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
    );
}
