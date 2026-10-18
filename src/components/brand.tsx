import Link from "next/link";

export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="15" fill="var(--brand-mark-bg)" />
      <path
        d="M15.5 18.5h17l-1.6 18.1a4 4 0 0 1-4 3.6h-5.8a4 4 0 0 1-4-3.6l-1.6-18.1Z"
        fill="var(--brand-cup)"
      />
      <path
        d="M13 15.5h22"
        stroke="var(--brand-straw)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M25.5 14.5 28 7.5"
        stroke="var(--brand-straw)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="27" r="1.9" fill="var(--brand-pearl)" />
      <circle cx="27" cy="31.5" r="1.7" fill="var(--brand-pearl)" />
      <circle cx="23" cy="36" r="1.5" fill="var(--brand-pearl)" />
      <path
        d="M18 22.5h12"
        stroke="var(--brand-straw)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

export function Brand({
  href = "/",
  size = 38,
  compact = false,
  className = "",
}: {
  href?: string;
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={`brand ${className}`} aria-label="Milktea Cloud">
      <BrandMark size={size} />
      {!compact && (
        <span className="brand-word">
          <span className="brand-word-main">Milktea</span>
          <span className="brand-word-sub">Cloud</span>
        </span>
      )}
    </Link>
  );
}
