// CensusPage.tsx
// Dashboard layout split into focused sub-components:
//   YearTabs        — year selector strip
//   CensusSearch    — search input for TopBar slot
//   ChartPanel      — map + bar + stacked comparison
//   StatsPanel      — biggest + change table + export
//   CensusPage      — composes everything, owns state

import React, { useState, useEffect } from "react";
import { useSearchSlot } from "../SearchSlotContext";
import { YearTabs } from "../components/census/YearTabs";
import { CensusSearch } from "../components/census/CensusSearch";
import { ChartPanel } from "../components/census/ChartPanel";
import { StatsPanel } from "../components/census/StatsPanel";
import { type ChangeRow, type BiggestItem } from "../components/census/types";

const API = "/api";

const PREV_YEAR: Record<number, number> = {
  2021: 2016,
  2016: 2011,
  2011: 2006,
  2006: 2001,
  2001: 2001,
};

export const CensusPage: React.FC = () => {
  const { setSlot } = useSearchSlot();
  const [availableYears, setAvailableYears] = useState<number[]>([2021]);
  const [year, setYear] = useState(2021);
  const [row, setRow] = useState(37);
  const [mapFig, setMapFig] = useState<any>(null);
  const [barFig, setBarFig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [changeData, setChangeData] = useState<ChangeRow[]>([]);
  const [biggest, setBiggest] = useState<BiggestItem[]>([]);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [prevLabel, setPrevLabel] = useState<string>("");

  useEffect(() => {
    fetch(`${API}/years`)
      .then(r => r.json())
      .then(d => {
        setAvailableYears(d.years);
        if (d.years.length) setYear(d.years[0]);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setBiggest([]);
    setChangeData([]);
    const prevYear = PREV_YEAR[year] ?? year;
    Promise.all([
      fetch(`${API}/census/${year}/row/${row}/map`).then(r => r.json()),
      fetch(`${API}/census/${year}/row/${row}/bar`).then(r => r.json()),
      prevYear !== year
        ? fetch(`${API}/census/${year}/row/${row}/compare/${prevYear}`)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([map, bar, compareData]) => {
        setMapFig(map);
        setBarFig(bar);
        if (bar?.layout?.title?.text) setTitle(bar.layout.title.text);

        if (bar?.data?.[0]) {
          setBiggest(
            (bar.data[0].x as string[])
              .map((n: string, i: number) => ({ name: n, val: bar.data[0].y[i] as number }))
              .filter(x => x.val && x.val > 0)
              .sort((a, b) => b.val - a.val)
              .slice(0, 2)
          );
        }

        if (compareData?.data) {
          setMatchScore(compareData.match_score ?? null);
          setPrevLabel(compareData.prev_label ?? "");
          setChangeData(
            Object.entries(compareData.data)
              .map(([n, v]: [string, any]) => ({
                neighbourhood: n,
                current: v.current,
                prev: v.prev,
                mapping: compareData.mapping?.[n] ?? undefined,
              }))
              .sort((a, b) => Math.abs(b.current - b.prev) - Math.abs(a.current - a.prev))
          );
        }
      })
      .finally(() => setLoading(false));
  }, [year, row]);

  useEffect(() => {
    setSlot(<CensusSearch year={year} onSelect={setRow} apiBase={API} />);
    return () => setSlot(null);
  }, [setSlot, year]);

  const prevYear = PREV_YEAR[year] ?? year;

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-2 pt-3">
        {title && <div className="mb-2 text-base font-semibold text-[var(--text)]">{title}</div>}
        <YearTabs years={availableYears} active={year} onSelect={setYear} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ChartPanel mapFig={mapFig} barFig={barFig} loading={loading} year={year} row={row} />
        <StatsPanel
          biggest={biggest}
          changeData={changeData}
          year={year}
          prevYear={prevYear}
          row={row}
          matchScore={matchScore}
          prevLabel={prevLabel}
          apiBase={API}
        />
      </div>
    </div>
  );
};
