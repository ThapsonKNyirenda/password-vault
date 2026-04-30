interface StatusBadgeProps {
    status: string;
}

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
    return <span className={`status ${status}`}>{status}</span>;
}
