// The app's mark: an interstate-style shield with a route running through it.
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 34" className={className} aria-hidden>
      <path
        d="M3 6 Q3 2.5 7 3 Q16 4.5 25 3 Q29 2.5 29 6 L29 14 Q29 26 16 31 Q3 26 3 14 Z"
        fill="#1f4e9c"
      />
      <path
        d="M9 24 C 12 16, 18 20, 23 10"
        stroke="#ffffff"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="9" cy="24" r="2.4" fill="#22a454" />
      <circle cx="16" cy="17.6" r="2.4" fill="#e6b100" />
      <circle cx="23" cy="10" r="2.4" fill="#22a454" />
    </svg>
  );
}
