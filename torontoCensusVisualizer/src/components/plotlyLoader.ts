type PlotlyApi = {
  react: (el: HTMLDivElement, data: unknown[], layout: unknown) => void;
  purge: (el: HTMLDivElement) => void;
  Plots: {
    resize: (el: HTMLDivElement) => void;
  };
};

let basicPromise: Promise<PlotlyApi> | null = null;
let mapboxPromise: Promise<PlotlyApi> | null = null;

function unwrapPlotly(module: unknown): PlotlyApi {
  const candidate = module as { default?: PlotlyApi };
  return candidate.default ?? (module as PlotlyApi);
}

export function loadPlotlyBasic(): Promise<PlotlyApi> {
  if (!basicPromise) {
    basicPromise = import("plotly.js-basic-dist-min").then(unwrapPlotly);
  }
  return basicPromise;
}

export function loadPlotlyMapbox(): Promise<PlotlyApi> {
  if (!mapboxPromise) {
    mapboxPromise = import("plotly.js-mapbox-dist-min").then(unwrapPlotly);
  }
  return mapboxPromise;
}
