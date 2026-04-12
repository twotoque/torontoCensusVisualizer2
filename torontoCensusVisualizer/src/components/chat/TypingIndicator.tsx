import React from "react";

export const TypingIndicator: React.FC = () => (
  <div className="flex justify-start px-6">
    <div className="rounded-3xl rounded-bl-md border border-[var(--border)] bg-[var(--bot-bubble)] px-4 py-3 shadow-[var(--shadow)]">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="typing-dot mx-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  </div>
);
