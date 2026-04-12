import React, { useEffect, useRef } from "react";
import { type Message } from "./types";
import { type CellTarget } from "../cell/CellViewer";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  onSelect: (rowId: number, year: number, question: string) => void;
  onJumpToCell: (target: CellTarget) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  onSelect,
  onJumpToCell,
}) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-6">
      {messages.length === 0 && (
        <div className="mt-12 text-center text-sm text-[var(--text-muted)]">
          <div className="mb-3 text-4xl font-semibold tracking-wider text-[var(--text)]">TCV</div>
          <div className="mb-2 text-base font-semibold text-[var(--text)]">
            Toronto Census Visualizer
          </div>
          <div>Ask about population, income, housing and more across Toronto neighbourhoods.</div>
          <div className="mt-3 text-xs">e.g. "What was the population of York University Heights in 2011?"</div>
        </div>
      )}

      {messages.map(msg => (
        <MessageBubble key={msg.id} msg={msg} onSelect={onSelect} onJumpToCell={onJumpToCell} />
      ))}

      {loading && <TypingIndicator />}

      <div ref={endRef} />
    </div>
  );
};
