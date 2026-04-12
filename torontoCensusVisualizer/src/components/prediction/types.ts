export interface PredecessorSeries {
  weight: number;
  historical: Record<number, number>;
}

export interface ForecastResult {
  neighbourhood: string;
  historical: Record<number, number>;
  forecast: Record<number, { mean: number; lower: number; upper: number }>;
  forecast_gp_only: Record<number, { mean: number; lower: number; upper: number }>;
  gp_full: { years: number[]; mean: number[]; lower: number[]; upper: number[] };
  shap: { features: string[]; years: number[]; values: Record<string, number>[] };
  is_split?: boolean;
  error?: string;
  predecessors: { name: string; weight: number; source_neighbourhood?: string }[];
  predecessor_series: Record<string, PredecessorSeries>;
}
