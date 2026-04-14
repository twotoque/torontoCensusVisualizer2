// src/components/Plot.tsx
import React, { useEffect, useRef } from "react";
import Plotly from "plotly.js-basic-dist-min";

interface PlotProps {
  data: any[];
  layout?: any;
  style?: React.CSSProperties;
}

const Plot: React.FC<PlotProps> = ({ data, layout, style }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    Plotly.react(ref.current, data, layout ?? {});
  }, [data, layout]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => Plotly.Plots.resize(el));
    observer.observe(el);
    return () => {
      observer.disconnect();
      Plotly.purge(el);
    };
  }, []);

  return <div ref={ref} style={style} />;
};

export default Plot;