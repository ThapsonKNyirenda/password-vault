interface StatusBadgeProps {
    status: string;
}

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
    const label = status.replace(/_/g, " ");
    return <span className={`status ${status}`}>{label}</span>;
}
