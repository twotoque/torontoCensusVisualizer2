import React from "react";
import { useNavigate } from "react-router-dom";
import headerImg from "../assets/Header img.png";
import {
  ArrowRight,
  ChevronRight,
  Github,
  Map,
  LineChart,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

const featureCards = [
  {
    icon: Map,
    title: "Historical coverage",
    copy: "Move through five census snapshots spanning 2001 to 2021 and see how neighbourhoods changed over time.",
    route: "/census",
  },
  {
    icon: LineChart,
    title: "Forecast-ready",
    copy: "Review experimental population forecasts for 2026 and 2031 with confidence bands and model explanations.",
    route: "/prediction",
  },
  {
    icon: MessageSquareText,
    title: "Ask in plain language",
    copy: "Use the assistant to answer questions like population, housing, and change by neighbourhood or year.",
    route: "/ask",
  },
  {
    icon: ShieldCheck,
    title: "Business approachable",
    copy: "Built for planning, analysis, and reporting workflows where a clear story matters as much as the chart.",
    route: "/compare",
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)] text-[var(--text)]">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(75,108,183,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(17,94,89,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),transparent_22%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] opacity-60" />

        <section className="relative mx-auto md:pt-10 lg:pt-16 flex max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10 lg:py-12">

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="space-y-7 ">
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  View 20+ years of Toronto census data with AI-driven insights easily.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                  Explore neighbourhood trends from 2001 to 2021, compare change across census releases,
                  and review experimental forecasts for 2026 and 2031, all with AI-powered search and explanations.
                </p>
                <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              <strong>Toronto Census Visualizer is currently on beta testing and some results may be inaccurate.</strong> Treat results as experimental. If you find an error, feel free to submit an issue / create a pull request on the <a href="https://github.com/twotoque/torontoCensusVisualizer2" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">GitHub repository</a>. 
            </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/census")}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition hover:bg-[var(--accent-hover)]"
                >
                  Open Census Explorer
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/prediction")}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow)] transition hover:bg-[var(--surface-alt)]"
                >
                  See Forecasts
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/ask")}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface)]"
                >
                  Ask a Question
                </button>
              </div>
            </div>

            <div className="overflow-hidden">
              <img
                src={headerImg}
                alt="Header graphic for the Toronto Census Visualizer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>


            <div className="space-y-10 pt-20 space-y-4">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-3xl lg:text-3xl">
                What makes ours different? 
              </h2>
          </div> 
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, copy, route }) => (
              <button
                key={title}
                type="button"
                onClick={() => navigate(route)}
                className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 text-left shadow-[var(--shadow)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-[var(--surface)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-lg font-semibold">{title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{copy}</p>
              </button>
            ))}
          </div>


            <div className="space-y-10 pace-y-4">
              <div className="flex items-center pb-0 mb-3">
                <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-3xl lg:text-3xl">
                  Credits
                </h2>
                </div>
                <p>Project by <a href="https://www.twotoque.com/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Derek Song</a>.</p> 
                <p>This project is not affiliated or endorsed by the City of Toronto or Statistics Canada. If you want to contribute, find a bug, or have feedback, please submit an issue or create a pull request on the <a href="https://github.com/twotoque/toronto-census-visualizer" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Github Repository </a>.</p>
              
          </div> 

        </section>
      </div>
    </div>
  );
};
