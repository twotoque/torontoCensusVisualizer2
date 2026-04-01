// ChatPage.tsx
// Chat interface split into three sub-components:
//   <MessageList>   — scrollable history of messages
//   <MessageBubble> — individual message rendering
//   <ChatInput>     — textarea + send button

import React, { useState, useEffect, useRef } from "react";
import { type Tokens } from "./colours";

const API = "/api";

// ── types ────────────────────────────────────────────────────────────────────

export type MsgRole = "user" | "assistant" | "disambiguation";

export interface DisambigOption {
  row_id:    number;
  year:      number;
  label:     string;
  document?: string;
}

export interface Message {
  id:        string;
  role:      MsgRole;
  content:   string;
  options?:  DisambigOption[];
  question?: string;  // original question for disambiguation follow-up
}

// ── icons ─────────────────────────────────────────────────────────────────────

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  t:        Tokens;
  msg:      Message;
  onSelect: (rowId: number, year: number, question: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ t, msg, onSelect }) => {
  const isUser   = msg.role === "user";
  const isDisam  = msg.role === "disambiguation";

  const bubbleStyle: React.CSSProperties = {
    maxWidth: "66%",
    padding: isDisam ? "14px 16px" : "10px 14px",
    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
    background: isUser ? t.userBubble : isDisam ? t.disambig : t.botBubble,
    color:      isUser ? t.userBubbleText : t.botBubbleText,
    border: isDisam
      ? `1px solid ${t.disambigBorder}`
      : `1px solid ${t.border}`,
    boxShadow: t.shadow,
    fontSize: 14, lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      padding: "0 24px",
    }}>
      <div style={bubbleStyle}>
        {isDisam ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: t.textMuted }}>
              {msg.content}
            </div>
            {msg.options?.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelect(opt.row_id, opt.year, msg.question || "")}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 12px", marginBottom: 6,
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: 8, cursor: "pointer", fontSize: 13,
                  color: t.text, fontWeight: 500,
                  transition: "background 0.12s",
                }}
              >
                {opt.document || opt.label} ({opt.year})
              </button>
            ))}
          </>
        ) : (
          msg.content
        )}
      </div>
    </div>
  );
};

// ── TypingIndicator ───────────────────────────────────────────────────────────

export const TypingIndicator: React.FC<{ t: Tokens }> = ({ t }) => (
  <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 24px" }}>
    <div style={{
      padding: "12px 16px", borderRadius: "18px 18px 18px 4px",
      background: t.botBubble, border: `1px solid ${t.border}`,
      boxShadow: t.shadow,
    }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "inline-block", width: 6, height: 6,
          borderRadius: "50%", background: t.textMuted,
          margin: "0 2px",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  </div>
);

// ── MessageList ───────────────────────────────────────────────────────────────

interface MessageListProps {
  t:         Tokens;
  messages:  Message[];
  loading:   boolean;
  onSelect:  (rowId: number, year: number, question: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ t, messages, loading, onSelect }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: "24px 0",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      {messages.length === 0 && (
        <div style={{ textAlign: "center", color: t.textMuted, marginTop: 60, fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>TCV</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: t.text, marginBottom: 6 }}>
            Toronto Census Visualizer
          </div>
          <div>Ask about population, income, housing and more across Toronto neighbourhoods.</div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            e.g. "What was the population of York University Heights in 2011?"
          </div>
        </div>
      )}

      {messages.map(msg => (
        <MessageBubble key={msg.id} t={t} msg={msg} onSelect={onSelect} />
      ))}

      {loading && <TypingIndicator t={t} />}

      <div ref={endRef} />
    </div>
  );
};

// ── ChatInput ─────────────────────────────────────────────────────────────────

interface ChatInputProps {
  t:            Tokens;
  value:        string;
  loading:      boolean;
  hasMessages:  boolean;
  onChange:     (v: string) => void;
  onSend:       () => void;
  onClear:      () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  t, value, loading, hasMessages, onChange, onSend, onClear,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled    = loading || !value.trim();

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  return (
    <div style={{
      padding: "12px 24px 20px",
      background: t.bg, borderTop: `1px solid ${t.border}`,
      flexShrink: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 8,
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: 14, padding: "8px 8px 8px 14px",
        boxShadow: t.shadow,
      }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Ask about Toronto census data..."
          rows={1}
          style={{
            flex: 1, border: "none", outline: "none", resize: "none",
            background: "transparent", color: t.text,
            fontSize: 14, lineHeight: 1.5, fontFamily: "inherit",
            minHeight: 24, maxHeight: 160, overflowY: "auto",
          }}
        />
        <button
          onClick={onSend}
          disabled={disabled}
          style={{
            width: 34, height: 34, borderRadius: 8, border: "none",
            background: disabled ? t.surfaceAlt : t.accent,
            color:      disabled ? t.textMuted   : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: disabled ? "default" : "pointer",
            flexShrink: 0, transition: "background 0.15s",
          }}
        >
          <IconSend />
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>Shift+Enter for new line</span>
        {hasMessages && (
          <button
            onClick={onClear}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer",
              color: t.textMuted, fontSize: 12,
            }}
          >
            <IconTrash /> Clear history
          </button>
        )}
      </div>
    </div>
  );
};

// ── ChatPage ──────────────────────────────────────────────────────────────────

interface ChatPageProps {
  t: Tokens;
}

function uid() { return Math.random().toString(36).slice(2); }

export const ChatPage: React.FC<ChatPageProps> = ({ t }) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem("chat_history") || "[]"); }
    catch { return []; }
  });
  const [question, setQuestion] = useState("");
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(messages));
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
      }).then(r => r.json());

      if (d.disambiguation?.length) {
        setMessages(m => [...m, {
          id: uid(), role: "disambiguation",
          content: "Multiple matches found — which did you mean?",
          options: d.disambiguation,
          question: q,
        }]);
      } else {
        setMessages(m => [...m, {
          id: uid(), role: "assistant",
          content: d.answer || "No answer returned.",
        }]);
      }
    } catch {
      setMessages(m => [...m, { id: uid(), role: "assistant", content: "Error contacting the server." }]);
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
        body: JSON.stringify({ question: origQuestion, confirmed_row_id: rowId, confirmed_year: year }),
      }).then(r => r.json());
      setMessages(m => [...m, {
        id: uid(), role: "assistant",
        content: d.answer || "No answer returned.",
      }]);
    } catch {
      setMessages(m => [...m, { id: uid(), role: "assistant", content: "Error contacting the server." }]);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setMessages([]);
    localStorage.removeItem("chat_history");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <MessageList t={t} messages={messages} loading={loading} onSelect={confirm} />
      <ChatInput
        t={t}
        value={question}
        loading={loading}
        hasMessages={messages.length > 0}
        onChange={setQuestion}
        onSend={send}
        onClear={clear}
      />
    </div>
  );
};