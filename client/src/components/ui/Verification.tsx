import { Badge, type BadgeProps } from './Badge';

export function VerificationBadges({
  identityVerified,
  businessVerified,
  compact = false,
}: {
  identityVerified: boolean;
  businessVerified: boolean;
  compact?: boolean;
}) {
  if (businessVerified) {
    return (
      <span
        className="inline-flex"
        title="An administrator reviewed business details submitted by this provider."
      >
        <Badge variant="brand">
          <ShieldCheckIcon />
          {compact ? 'Business' : 'Business verified'}
        </Badge>
      </span>
    );
  }
  if (identityVerified) {
    return (
      <span
        className="inline-flex"
        title="An administrator reviewed this provider's identity details."
      >
        <Badge variant="sky">
          <ShieldCheckIcon />
          {compact ? 'ID checked' : 'ID checked'}
        </Badge>
      </span>
    );
  }
  return (
    <span
      className="inline-flex"
      title="This provider is registered but has not completed an identity or business check."
    >
      <Badge variant="outline">Not yet verified</Badge>
    </span>
  );
}

export function DemoBadge({ label = 'Demo record' }: { label?: string }) {
  return (
    <Badge
      variant="sun"
      title="Sample data created by the development seed script. Not a real business or customer."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-sun-deep" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'brand' | 'sun' | 'sky' | 'danger';
}) {
  return <Badge variant={tone}>{label}</Badge>;
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
      <path
        d="M8 1.6 13 3.4v4.1c0 3-2 5.4-5 6.5-3-1.1-5-3.5-5-6.5V3.4L8 1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m5.7 7.8 1.5 1.5 3-3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type BadgeTone = BadgeProps['variant'];
