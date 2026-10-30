// The app's own mark: a route line through three risk-coloured checkpoints.
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#043344" />
      <path
        d="M7 23c4-9 9-3 18-13"
        stroke="#40e0d0"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="7" cy="23" r="2.6" fill="#22c55e" />
      <circle cx="16" cy="15.5" r="2.6" fill="#eab308" />
      <circle cx="25" cy="10" r="2.6" fill="#22c55e" />
    </svg>
  );
}
