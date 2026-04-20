export const Spinner: React.FC = () => (
  <div className="flex flex-col items-center gap-2">
    <svg
      className="h-7 w-7 animate-spin text-[var(--accent)]"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
    <span className="text-xs font-medium text-[var(--text-muted)]">Loading…</span>
  </div>
);