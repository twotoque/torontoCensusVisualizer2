import headerImg from "../assets/HeaderImg 2.png";
import { useState, useMemo } from "react";
import censusVideo from "../assets/CensusView.mp4";
import predictionVideo from "../assets/Prediction.mp4";
import chatVideo from "../assets/Chat.mp4";
import compareVideo from "../assets/Compare.mp4";
import old from "../assets/old.png";
import graph from "../assets/graph.png";
import {
  Map,
  LineChart,
  MessageCircle,
  BarChart3,
} from "lucide-react";

const featureCards = [
  {
    id: "census",
    icon: Map,
    title: "Census Explorer",
    copy: "Move through five census snapshots spanning 2001 to 2021 and see how neighbourhoods changed over time.",
    route: "/census",
    video: censusVideo,
  },
  {
    id: "prediction",
    icon: LineChart,
    title: "Prediction",
    copy: "Review experimental population forecasts for 2026 and 2031 with confidence bands and model explanations.",
    route: "/prediction",
    video: predictionVideo,
  },
  {
    id: "ask",
    icon: MessageCircle,
    title: "Ask",
    copy: "Use the assistant to answer questions like population, housing, and change by neighbourhood or year. This is localized and isolated; it won't answer questions about other cities or general knowledge.",
    route: "/ask",
    video: chatVideo,
  },
  {
    id: "compare",
    icon: BarChart3,
    title: "Compare",
    copy: "Built for planning, analysis, and reporting workflows where a clear story matters as much as the chart.",
    route: "/compare",
    video: compareVideo,
  },
];


export const WhatsNew: React.FC = () => {

      const [activeFeatureId, setActiveFeatureId] = useState(featureCards[0].id);
    
      const activeFeature = useMemo(
        () => featureCards.find(feature => feature.id === activeFeatureId) ?? featureCards[0],
        [activeFeatureId]
      );

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)] text-[var(--text)]">
      <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Introducing Toronto Census Visualizer 2.0
          </h1>
          
          <p className="pt-5 pb-5  text-base  text-[var(--bot-bubble-text)]">
           Toronto Census Visualizer 2.0 transforms census data into an neighbourhood interactive analyst. Council staff and residents can ask questions, see citywide trends, and peek into future scenarios without writing code. 
          </p>


            <img 
                src={headerImg}
                alt="Description of image"
                className="w-full h-auto rounded-2xl"
            />


             <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              <strong>Toronto Census Visualizer is currently on beta testing and some results may be inaccurate.</strong> Treat results as experimental. This tool is not endorsed or affiliated with the City of Toronto or Statistics Canada. If you find an error, feel free to submit an issue / create a pull request on the <a href="https://github.com/twotoque/torontoCensusVisualizer2" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">GitHub repository</a>. 
            </div>

          <p className="pt-5 pb-5  text-base  text-[var(--bot-bubble-text)]">
           Census data is huge. Permit data is huge, and both can be combined to generate unique insights on population data (and other fields in the future). This makes it hard for general stakeholders; such as council staff and the general public, to generate maps and graphs to conclude a claim. A council staffer responding to a constituent question about neighbourhood population change currently requires downloading multiple CSV files, needing to know and reference boundary changes, and manually building a chart: a process that takes 30–60+ minutes. 
          </p>

           <p className="pt-5 pb-5  text-base  text-[var(--bot-bubble-text)]">
           Meanwhile, residents increasingly expect interactive, conversational tools to understand high-level neighbourhood change. Toronto Census Visualizer 2.0 closes that gap: it layers natural-language querying, semantic search, and explainable forecasts using Toronto Open Data’s flagship datasets. By offering an “analyst in the browser,” the product cuts research time from hours to minutes and helps non-technical staff answer constituent questions.
          </p>

          <h2 className="text-3xl pt-5 pb-3 font-semibold tracking-tight sm:text-2xl">
            Here's what's new:
          </h2>

<div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {featureCards.map(({ id, icon: Icon, title, copy }) => {
                const active = activeFeatureId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onMouseEnter={() => setActiveFeatureId(id)}
                    onFocus={() => setActiveFeatureId(id)}
                    onClick={() => setActiveFeatureId(id)}
                    aria-pressed={active}
                    className={`w-full rounded-3xl border p-5 text-left shadow-[var(--shadow)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      active
                        ? "border-[var(--accent)] bg-[var(--surface)]"
                        : "border-[var(--border)] bg-[var(--surface)]/90 hover:bg-[var(--surface)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-lg font-semibold">{title}</div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{copy}</p>
                  </button>
                );
              })}
            </div>

            <div className="lg:sticky lg:top-6 order-first aspect-video overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white shadow-[var(--shadow-md)] lg:order-none">
              <video
                key={activeFeature.id}
                src={activeFeature.video}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="block h-full w-full object-contain bg-white"
              />
            </div>
          </div>



        </div>
        

          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            The story 
          </h2>


          <p className="text-base  text-[var(--bot-bubble-text)]">
           When I was a constituency assistant at the City of Toronto in summer 2024, I was assigned a <a href="https://www.twotoque.com/bikeshare" className="text-blue-500 underline hover:text-blue-600 transition-colors">task to research transportation and bike usage within an area in northern Scarborough</a>. This is when I discovered that the then-recent 2021 Census included some questions about how residents used biking, driving, and public transportation as a method of transportation.
            </p>
            <img 
                src={graph}
                alt="Description of image"
                className="mx-auto w-1/2 h-auto rounded-2xl"
            />


          <p className=" text-base  text-[var(--bot-bubble-text)]">
           This data was sourced from a program called the Toronto Open Data website which therein was collected by Statistics Canada. The problem was that there were 2604 rows in the census spreadsheet with 158 neighbourhoods. While I only had to focus on 5 specific topics, there was immense potential to help visualize it to showcase differences between Toronto’s vast size. 
            </p>


          <p className="text-base  text-[var(--bot-bubble-text)]">
           This friction is what led me to build the original Toronto Census Visualizer 1.0 back in 2024. My goal was simple: make this mountain of CSV data actually legible for council staff and residents who didn't have 60 minutes to spend building a single chart. The first iteration was a Python (Plotly and Dash) dashboard that allowed users to input a specific row number from the 2021 Census and immediately see it mapped across the city. It turned abstract numbers into interactive maps and multi-variable stacked bar graphs, giving us a way to visualize neighbourhood-specific trends at a glance.

            </p>

            <img 
                src={old}
                alt="Description of image"
                className="w-full h-auto rounded-2xl"
            />


      </section>
    </div>
  );
};
