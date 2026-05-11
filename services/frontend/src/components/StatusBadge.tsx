interface StatusBadgeProps {
    status: string;
    pulse?: boolean;
}

export function StatusBadge({ status, pulse = false }: StatusBadgeProps): JSX.Element {
    const label = status.replace(/_/g, " ");
    
    let variant = "badge-neutral";
    const s = status.toLowerCase();
    
    if (["active", "succeeded", "approved", "fulfilled"].includes(s)) {
        variant = "badge-success";
    } else if (["inactive", "failed", "denied", "expired", "error"].includes(s)) {
        variant = "badge-danger";
    } else if (["pending", "warning"].includes(s)) {
        variant = "badge-warning";
    } else if (["info", "agent", "sync"].includes(s)) {
        variant = "badge-info";
    }

    return (
        <span className={`badge ${variant} ${pulse ? "pulse" : ""}`}>
            <span className={`status-dot ${s}`} />
            {label}
        </span>
    );
}
