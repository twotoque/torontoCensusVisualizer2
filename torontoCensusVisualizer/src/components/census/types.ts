export interface ChangeRow {
  neighbourhood: string;
  current: number;
  prev: number;
  mapping?: { name: string; weight: number }[];
}

export interface BiggestItem {
  name: string;
  val: number;
}

export const formatMetric = (v: number) =>
  v > 100 ? v.toLocaleString("en-CA", { maximumFractionDigits: 0 }) : v.toFixed(2);
