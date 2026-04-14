// PromptBuilder.tsx
import React, { useState } from "react";

const INTENTS = [
  { value: "single_value",        label: "Single value" },
  { value: "trend",               label: "Trend over time" },
  { value: "compare_years",       label: "Compare years" },
  { value: "cross_neighbourhood", label: "Compare neighbourhoods" },
  { value: "ranking",             label: "Ranking" },
] as const;

type Intent = typeof INTENTS[number]["value"];

const METRICS = [
  { value: "population",                    label: "Population" },
  { value: "average total income",          label: "Avg income" },
  { value: "average household total income",label: "Household income" },
  { value: "dwelling units", label: "Housing / Dwellings" },
  { value: "employment income",             label: "Employment income" },
  { value: "mother tongue",                 label: "Mother tongue" },
  { value: "visible minority",              label: "Visible minority" },
];

const YEARS = [2001, 2006, 2011, 2016, 2021];

const NEEDS_YEAR:  Intent[] = ["single_value", "compare_years", "cross_neighbourhood", "ranking"];
const NEEDS_YEAR2: Intent[] = ["compare_years"];

interface PromptBuilderProps {
  neighbourhoods?: string[];   // optional — pass your full list for the dropdown
  onSend:  (query: string) => void;
  onClose: () => void;
}

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition
        ${active
          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
    >
      {label}
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function buildQuery(
  intent: Intent | null,
  metric: string | null,
  year1: number | null,
  year2: number | null,
  neighbourhood: string,
  neighbourhood2: string,
): string | null {
  if (!intent || !metric) return null;

  const n1 = neighbourhood  || "[neighbourhood]";
  const n2 = neighbourhood2 || "[neighbourhood 2]";

  switch (intent) {
    case "single_value":
      if (!year1) return null;
      return `What was ${metric} in ${n1} in ${year1}`;
    case "trend":
      return `How has ${metric} changed in ${n1} over time`;
    case "compare_years": {
      if (!year1 || !year2) return null;
      const [lo, hi] = [year1, year2].sort((a, b) => a - b);
      return `How did ${metric} change in ${n1} between ${lo} and ${hi}`;
    }
    case "cross_neighbourhood":
      if (!year1) return null;
      return `Compare ${metric} between ${n1} and ${n2} in ${year1}`;
    case "ranking":
      if (!year1) return null;
      return `Which neighbourhood had the highest ${metric} in ${year1}`;
  }
}

export const PromptBuilder: React.FC<PromptBuilderProps> = ({
  neighbourhoods = [],
  onSend,
  onClose,
}) => {
  const [intent,        setIntent]        = useState<Intent | null>(null);
  const [metric,        setMetric]        = useState<string | null>(null);
  const [year1,         setYear1]         = useState<number | null>(null);
  const [year2,         setYear2]         = useState<number | null>(null);
  const [neighbourhood, setNeighbourhood] = useState("");
  const [neighbourhood2,setNeighbourhood2]= useState("");
  const [neighSearch,   setNeighSearch]   = useState("");
  const [neighSearch2,  setNeighSearch2]  = useState("");

  function handleIntent(v: Intent) {
    setIntent(v);
    // reset year2 if switching away from compare_years
    if (!NEEDS_YEAR2.includes(v)) setYear2(null);
  }

  function handleYear(y: number) {
    if (intent === "compare_years") {
      if (year1 === y) { setYear1(year2); setYear2(null); return; }
      if (year2 === y) { setYear2(null); return; }
      if (!year1)  { setYear1(y); return; }
      if (!year2)  { setYear2(y); return; }
    } else {
      setYear1(year1 === y ? null : y);
    }
  }

  const showYear  = intent && NEEDS_YEAR.includes(intent);
  const showYear2 = intent === "compare_years";
  const showN2    = intent === "cross_neighbourhood";

  const query = buildQuery(intent, metric, year1, year2, neighbourhood, neighbourhood2);

  const filteredN  = neighbourhoods.filter(n =>
    n.toLowerCase().includes(neighSearch.toLowerCase()) && n !== neighbourhood2
  );
  const filteredN2 = neighbourhoods.filter(n =>
    n.toLowerCase().includes(neighSearch2.toLowerCase()) && n !== neighbourhood
  );

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">

      {/* header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Prompt builder
        </span>
        <button
          onClick={onClose}
          className="text-lg leading-none text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          ×
        </button>
      </div>

      {/* intent */}
      <Section label="Intent">
        {INTENTS.map(i => (
          <Chip
            key={i.value}
            label={i.label}
            active={intent === i.value}
            onClick={() => handleIntent(i.value)}
          />
        ))}
      </Section>

      {/* metric */}
      <Section label="Metric">
        {METRICS.map(m => (
          <Chip
            key={m.value}
            label={m.label}
            active={metric === m.value}
            onClick={() => setMetric(metric === m.value ? null : m.value)}
          />
        ))}
      </Section>

      {/* year(s) */}
      {showYear && (
        <Section label={showYear2 ? "Years (pick two)" : "Year"}>
          {YEARS.map(y => (
            <Chip
              key={y}
              label={String(y)}
              active={year1 === y || year2 === y}
              onClick={() => handleYear(y)}
            />
          ))}
        </Section>
      )}

      {/* neighbourhood(s) */}
      {intent && intent !== "ranking" && (
        <Section label="Neighbourhood">
          {neighbourhoods.length > 0 ? (
            <div className="flex w-full flex-col gap-1">
              <input
                value={neighSearch}
                onChange={e => setNeighSearch(e.target.value)}
                placeholder="Search neighbourhoods…"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {neighSearch && (
                <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-1">
                  {filteredN.slice(0, 8).map(n => (
                    <button
                      key={n}
                      onClick={() => { setNeighbourhood(n); setNeighSearch(""); }}
                      className="rounded px-2 py-1 text-left text-[12px] text-[var(--text)] hover:bg-[var(--surface-alt)]"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {neighbourhood && (
                <div className="flex items-center gap-1">
                  <Chip label={neighbourhood} active onClick={() => setNeighbourhood("")} />
                  <span className="text-[10px] text-[var(--text-muted)]">× click to clear</span>
                </div>
              )}
            </div>
          ) : (
            <input
              value={neighbourhood}
              onChange={e => setNeighbourhood(e.target.value)}
              placeholder="e.g. Agincourt North"
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            />
          )}
        </Section>
      )}

      {/* second neighbourhood for cross_neighbourhood */}
      {showN2 && (
        <Section label="Neighbourhood 2">
          {neighbourhoods.length > 0 ? (
            <div className="flex w-full flex-col gap-1">
              <input
                value={neighSearch2}
                onChange={e => setNeighSearch2(e.target.value)}
                placeholder="Search neighbourhoods…"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {neighSearch2 && (
                <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-1">
                  {filteredN2.slice(0, 8).map(n => (
                    <button
                      key={n}
                      onClick={() => { setNeighbourhood2(n); setNeighSearch2(""); }}
                      className="rounded px-2 py-1 text-left text-[12px] text-[var(--text)] hover:bg-[var(--surface-alt)]"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {neighbourhood2 && (
                <div className="flex items-center gap-1">
                  <Chip label={neighbourhood2} active onClick={() => setNeighbourhood2("")} />
                  <span className="text-[10px] text-[var(--text-muted)]">× click to clear</span>
                </div>
              )}
            </div>
          ) : (
            <input
              value={neighbourhood2}
              onChange={e => setNeighbourhood2(e.target.value)}
              placeholder="e.g. Malvern"
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            />
          )}
        </Section>
      )}

      {/* preview + send */}
      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
        <div className="min-h-8 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] italic text-[var(--text-muted)]">
          {query ?? "Complete the fields above to preview your query…"}
        </div>
        <button
          disabled={!query}
          onClick={() => query && onSend(query)}
          className={`rounded-md border px-4 py-2 text-[13px] font-medium transition
            ${query
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20"
              : "cursor-default border-[var(--border)] text-[var(--text-muted)] opacity-40"
            }`}
        >
          Ask ↗
        </button>
      </div>
    </div>
  );
};