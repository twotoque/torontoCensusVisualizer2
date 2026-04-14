import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-mapbox-dist-min";

const PlotGeo = createPlotlyComponent(Plotly as any);
export default PlotGeo;