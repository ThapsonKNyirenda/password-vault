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
