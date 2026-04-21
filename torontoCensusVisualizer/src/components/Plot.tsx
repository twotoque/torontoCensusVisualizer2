// src/components/Plot.tsx
import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "./Spinner";
import { loadPlotlyBasic } from "./plotlyLoader";

interface PlotProps {
  data: any[];
  layout?: any;
  style?: React.CSSProperties;
}

type PlotlyApi = Awaited<ReturnType<typeof loadPlotlyBasic>>;

const Plot: React.FC<PlotProps> = ({ data, layout, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [plotly, setPlotly] = useState<PlotlyApi | null>(null);

  useEffect(() => {
    let alive = true;
    loadPlotlyBasic().then(module => {
      if (alive) setPlotly(module);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ref.current || !plotly) return;
    plotly.react(ref.current, data, layout ?? {});
  }, [data, layout, plotly]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !plotly) return;
    const observer = new ResizeObserver(() => plotly.Plots.resize(el));
    observer.observe(el);
    return () => {
      observer.disconnect();
      plotly.purge(el);
    };
  }, [plotly]);

  return (
    <div ref={ref} style={style} className="relative">
      {!plotly && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  );
};

export default Plot;
