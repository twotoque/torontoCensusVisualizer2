// ChatPage.tsx
// Chat interface orchestrator that composes modular chat components from /components/chat

import React, { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { CellViewer, type CellInfo, type CellTarget } from "../components/cell/CellViewer";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { type Message } from "../components/chat/types";
import { PromptBuilder } from "../components/chat/PromptBuilder";
const API = "/api";

interface ApiResponse {
  answer?: string;
  context?: { cell?: CellInfo };
  disambiguation?: Array<{
    id?: number;
    row_id?: number;
    year: number;
    label?: string;
    document?: string;
    score?: number;
  }>;
}

function normalizeDisambiguation(options: NonNullable<ApiResponse["disambiguation"]>) {
  return options.map(opt => ({
    row_id: opt.row_id ?? opt.id ?? 0,
    year: opt.year,
    label: opt.label ?? opt.document ?? `#${opt.row_id ?? opt.id ?? 0}`,
    document: opt.document,
  }));
}

function uid() {
  return crypto.randomUUID();
}


export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("chat_history") || "[]");
    } catch {
      return [];
    }
  });
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [cellTarget, setCellTarget] = useState<CellTarget | null>(null);

  useEffect(() => {
    const stripped = messages.map(({ cell: _cell, ...rest }) => rest);
    localStorage.setItem("chat_history", JSON.stringify(stripped));
  }, [messages]);

  async function send() {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setMessages(m => [...m, { id: uid(), role: "user", content: q }]);
    setLoading(true);
    try {
      const d = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      }).then(r => r.json() as Promise<ApiResponse>);

      if (d.disambiguation?.length) {
        setMessages(m => [
          ...m,
          {
            id: uid(),
            role: "disambiguation",
            content: "Multiple matches found — which did you mean?",
            options: normalizeDisambiguation(d.disambiguation ?? []),
            question: q,
          },
        ]);
      } else {
        const sanitizedContent = DOMPurify.sanitize(d.answer || "No answer returned.");
        setMessages(m => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            content: sanitizedContent,
            cell: d.context?.cell,
          },
        ]);
      }
    } catch {
      setMessages(m => [
        ...m,
        { id: uid(), role: "assistant", content: "Error contacting the server." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function confirm(rowId: number, year: number, origQuestion: string) {
    setLoading(true);
    try {
      const d = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: origQuestion,
          confirmed_row_id: rowId,
          confirmed_year: year,
        }),
      }).then(r => r.json() as Promise<ApiResponse>);
      const sanitizedContent = DOMPurify.sanitize(d.answer || "No answer returned.");
      setMessages(m => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          content: sanitizedContent,
          cell: d.context?.cell,
        },
      ]);
    } catch {
      setMessages(m => [
        ...m,
        { id: uid(), role: "assistant", content: "Error contacting the server." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setMessages([]);
    localStorage.removeItem("chat_history");
  }
  const [showBuilder, setShowBuilder] = useState(false);
  const [neighbourhoods, setNeighbourhoods] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API}/predict/neighbourhoods`)
      .then(r => r.json())
      .then(d => setNeighbourhoods(d.neighbourhoods))
      .catch(err => {
        console.error("Failed to load neighbourhoods:", err);
        setNeighbourhoods([]);
      });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MessageList
        messages={messages}
        loading={loading}
        onSelect={confirm}
        onJumpToCell={setCellTarget}
      />
        {showBuilder && (
          <PromptBuilder
            neighbourhoods={neighbourhoods}
            onSend={(q) => { setQuestion(q); setShowBuilder(false); }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      <ChatInput
        value={question}
        loading={loading}
        hasMessages={messages.length > 0}
        onChange={setQuestion}
        onSend={send}
        onClear={clear}

        onToggleBuilder={() => setShowBuilder(p => !p)}
        showBuilder={showBuilder}
      />
      <CellViewer target={cellTarget} onClose={() => setCellTarget(null)} />
    </div>
  );
};
