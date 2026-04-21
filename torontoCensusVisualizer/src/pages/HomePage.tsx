import React, { useMemo, useState } from "react";
import { href, useNavigate } from "react-router-dom";
import headerImg from "../assets/Header img.png";
import censusVideo from "../assets/CensusView.mp4";
import predictionVideo from "../assets/Prediction.mp4";
import chatVideo from "../assets/Chat.mp4";
import compareVideo from "../assets/Compare.mp4";
import paperImg from "../assets/paper.png";
import {
  ArrowRight,
  ChevronRight,
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

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeFeatureId, setActiveFeatureId] = useState(featureCards[0].id);

  const activeFeature = useMemo(
    () => featureCards.find(feature => feature.id === activeFeatureId) ?? featureCards[0],
    [activeFeatureId]
  );

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)] text-[var(--text)]">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(75,108,183,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(17,94,89,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),transparent_22%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] opacity-60" />

        <section className="relative mx-auto md:pt-10 lg:pt-16 flex max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10 lg:py-12">

          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
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
              <strong>Toronto Census Visualizer is currently on beta testing and some results may be inaccurate.</strong> Treat results as experimental. This tool is not endorsed or affiliated with the City of Toronto or Statistics Canada. If you find an error, feel free to submit an issue / create a pull request on the <a href="https://github.com/twotoque/torontoCensusVisualizer2" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">GitHub repository</a>. 
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


            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] lg:items-start">
              <div className="space-y-10 pace-y-4">
                <div className="flex items-center pb-0 mb-3">
                  <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-3xl lg:text-3xl">
                    Credits
                  </h2>
                </div>
                <p>
                  Project by{" "}
                  <a
                    href="https://www.twotoque.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Derek Song
                  </a>.
                </p>

                <p>
                  This project is not affiliated or endorsed by the City of Toronto or Statistics Canada. If
                  you want to contribute, find a bug, or have feedback, please submit an issue or create a pull
                  request on the{" "}
                  <a
                    href="https://github.com/twotoque/torontoCensusVisualizer2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Github Repository
                  </a>
                  . As such, please use at your own risk.
                </p>
                
                <p>
                  We also produced a white paper outlining the ongoing tests conducted to improve the
                  accuracy of the model, as well as a basic high level architecture overview.
                </p>
                <button
                  type="button"
                  onClick={() => window.open("https://docs.google.com/document/d/1SNGPiXUhtpM14wsuH2g4CMaPnX8PJAeJI8bSigpDG-w/edit?usp=sharing", "_blank")}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow)] transition hover:bg-[var(--surface-alt)]"
                >
                  View White Paper
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="order-last overflow-hidden lg:order-none">
                <img
                  src={paperImg}
                  alt="White paper preview"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

        </section>
      </div>
    </div>
  );
};
