import headerImg from "../assets/HeaderImg 2.png";
import { useState, useMemo } from "react";
import censusVideo from "../assets/CensusView.mp4";
import predictionVideo from "../assets/Prediction.mp4";
import chatVideo from "../assets/Chat.mp4";
import compareVideo from "../assets/Compare.mp4";
import old from "../assets/old.png";
import graph from "../assets/graph.png";

import { useNavigate } from "react-router-dom";

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


export const WhatsNew: React.FC = () => {

  const navigate = useNavigate();

      const [activeFeatureId, setActiveFeatureId] = useState(featureCards[0].id);
    
      const activeFeature = useMemo(
        () => featureCards.find(feature => feature.id === activeFeatureId) ?? featureCards[0],
        [activeFeatureId]
      );

  return (
    <>
    <div className="h-full overflow-y-auto bg-[var(--bg)] text-[var(--text)]">
      <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Introducing Toronto Census Visualizer 2.0
          </h1>
          
          <p className="pt-5 pb-5  text-base  text-[var(--bot-bubble-text)]">
           Toronto Census Visualizer 2.0 transforms census data into an neighbourhood interactive analyst. Council staff and residents can ask questions, see citywide trends, and peek into future scenarios without writing code. 
          </p>

        

          <div className="flex flex-wrap pb-4 gap-3">
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
          <p>
                  Project by{" "}
                  <a
                    href="https://www.twotoque.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Derek Song
                  </a>. Not affliated/endorsed with the City of Toronto or Statistics Canada. 
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
           When I was a constituency assistant at the City of Toronto in summer 2024, I was assigned a <a href="https://www.twotoque.com/bikeshare" className="underline hover:no-underline">task to research transportation and bike usage within an area in northern Scarborough</a>. This is when I discovered that the then-recent 2021 Census included some questions about how residents used biking, driving, and public transportation as a method of transportation.
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


          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            The evolution to 2.0
          </h2>


          <p className="text-base  text-[var(--bot-bubble-text)]">
            In 2026, I began experimenting more with machine learning and realized that by leveraging retrieval augmented generation (i.e. something similar to ChatGPT, Gemini), natural language processing, and Gaussian processes, we could reduce the many pain points users had with the original version, such as trying to find the exact row number to query a census datapoint. Likewise, the Open Data repository has over 2 decades worth of data, and this tool should be updated to support future years, including the one happening this year. 
            </p>


          <p className="text-base  text-[var(--bot-bubble-text)]">
            Infrastructure wise, it was running a Heroku container which wasn’t the most efficient. This evolution led me to frame the central challenge of the 2.0 version:
            </p>


          <h3 className="text-xl ml-10 tracking-tight sm:text-lg sm:ml-5">
            How might we leverage natural language intelligence and predictive modeling to make 20+ years of complex civic data instantly accessible and actionable for every Torontonian?
          </h3>


          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            Building it and architectural overview
          </h2>


          <p className="text-base  text-[var(--bot-bubble-text)]">
           This project is built as a React frontend with a Go API gateway and a Python backend that serves the census data, search, chart, and prediction endpoints. We chose a React frontend as compared to a Python-only Plotly + Dash in v1.0 because we found that using Python for the frontend was taking a lot of resources and slower. By separating the concerns, we can utilize Go’s fast proxy speeds via gRPC for the API gateway while reserving Python for the more machine learning-heavy tasks like forecasting.
            </p>



          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            Is this a GPT-wrapper? 
          </h2>


          <p className="text-base  text-[var(--bot-bubble-text)]">
           (TLDR: <b>Not exactly.</b>) The assistant is grounded in local census data and structured retrieval, which helps reduce hallucinations compared to a purely open-ended chatbot. I found this important for learning (i.e. I don't want to build a simple chatbot) as well as I don't want it searching and making up information for random queries. </p> 
           
           <p className="text-base  text-[var(--bot-bubble-text)]">
           The tradeoff is that it can still be sensitive to how a question is phrased, which is why we also added a prompt builder to help users form cleaner, more consistent queries. 
           We've also added sentence enhancements for key phrases so common requests are easier for the system to understand.  Finally, this tool features a "Jump to Cell" feature that lets users verify the source data behind the assistant's answers, which is especially important when it detects large variations that could indicate mismatched metrics across years.
            </p>



          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            Predictions 
          </h2>

          <p className="text-base  text-[var(--bot-bubble-text)]">
                I chose Gaussian Processes because census data is naturally aggregated, comes out every couple of years, and this project has to deal with neighbourhood boundary changes over time. The model also gives uncertainty estimates, which is important when the historical data is sparse. (<a href="https://arxiv.org/abs/1906.09412" className="underline hover:no-underline">Yousefi et. al, 2019</a>). I also added SHAP so the model helps show why the forecast is leaning in a certain direction (<a href="https://www.youtube.com/watch?v=MQ6fFDwjuco2" className="underline hover:no-underline">Found these videos by A Data Odyssey useful</a>). On top of that, I experimented with <a href="https://open.toronto.ca/dataset/building-permits-cleared-permits/" className="underline hover:no-underline">permit data</a> as an extra signal to see whether development activity could improve the forecast, especially in neighbourhoods where census trends alone were not enough.
            </p>

            <p className="text-base  text-[var(--bot-bubble-text)]">
                I've limited the predictions to population forecasts for now as a proof of concept, as well as to avoid redlining issues around forecasting more sensitive data like income.
            </p>


          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            The neighbourhood division problem 
          </h2>


          <p className="text-base  text-[var(--bot-bubble-text)]">
           The neighborhood division problem was a significant technical hurdle caused by the City of Toronto increasing its neighborhood count from 140 to 158 in 2021. This change created a "boundary discontinuity" that standard models would incorrectly interpret as a population trend rather than a geographic shift.
            </p>

          <p className="text-base  text-[var(--bot-bubble-text)]">
           I've attempted to address this using an areal interpolation parquet.  Right now it is very basic; if Area A was made up of 60% of Area B and 40% of Area C, then that is what is represented in the parquet.  However, this doesn't account for the fact that population density isn't uniform across a neighborhood. I've also attempted to use lower-level dissemination area data to help refine this, but it is very computationally expensive and not currently implemented in the live version. This is an area for future improvement, and I'm open to suggestions on how to better solve this problem.
            </p>

            <p className="text-base  text-[var(--bot-bubble-text)]">
                This problem is most prevalent in neighbourhoods that were split (defined as those that changed a lot during the translation period), compared to those who were stable (defined as those that had minimal change during the translation period). When using population prediction data, split neighbourhoods show acceptable 2016 performance but near-total 2021 breakdown, confirming that the parquet system right now is somewhat insufficient for reliable forecasting. These 36 neighbourhoods are flagged in the user interface with a reliability warning.
            </p>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="text-sm font-semibold text-[var(--text)]">
                  Forecast performance by neighbourhood type
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--surface-alt)]">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Metric
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Stable (n=120)
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Split (n=36)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">2016 Median MAPE</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">3.2%</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">11.6%</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">2016 CI Coverage</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">69.2%</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">52.8%</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">2021 Median MAPE</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">3.3%</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">89.1%</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text)]">2021 CI Coverage</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">64.2%</td>
                      <td className="px-4 py-3 text-[var(--bot-bubble-text)]">5.6%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            

          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            Format changes between 2002-2016 and 2021-present
          </h2>

            <p className="text-base text-[var(--bot-bubble-text)]">
                The CSV format changes a lot between the older census files and 2021. For example, a 2016 row starts with columns like `_id`, `Category`, `Topic`, and `Characteristic`, while 2021 starts with `Neighbourhood Name` and puts the neighbourhoods across the columns instead. That means the file structure, labels, and units all need different handling before the data can be compared cleanly. 
            </p>


            <p className="text-base text-[var(--bot-bubble-text)]">
                When comparing two rows from different years, the program tries to add a confidence score and display it to the user to ensure that the user can spot any potentially inaccurate comparisons or units. This is displayed in the user interface. 
            </p>


          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            Infrastructure 
          </h2>

            <p className="text-base text-[var(--bot-bubble-text)]">
                This project was also a great way to sharpen my skills in a pure Docker environment. Since we had a three-tiered program managing them in containers was essential for development best practices. 
            </p>

            <p className="text-base text-[var(--bot-bubble-text)]">
                To move away from the limitations of the previous Heroku setup, I transitioned the infrastructure to Hetzner. This allowed for a more cost-effective and high-performance environment where I could fully orchestrate the containers. Using a Docker Compose setup, I was able to manage the networking between the Go proxy and the FastAPI services, ensuring that the heavy computation required for the Gaussian Process forecasts and SHAP explanations had the dedicated resources they needed without slowing down the user experience.
            </p>

            <p className="text-base text-[var(--bot-bubble-text)]">
                This led to a 76% reduction in server costs compared to the previous Heroku setup, while also improving response times for the more intensive tasks.
            </p>


          <h2 className="text-3xl pt-5 font-semibold tracking-tight sm:text-2xl">
            What's next
          </h2>


            <p className="text-base text-[var(--bot-bubble-text)]">
                It was great to hear from the many users and staff who appreciated this tool and gave some great feedback. While this is a great foundation, there are many opportunities to improve the accuracy, reliability, and user experience of this tool. These include improving the areal interpolation method to better handle boundary changes, improvements to the prediction model, and a deeper dive into how we can interpret the SHAP values better. 
            </p>



            <p className="text-base text-[var(--bot-bubble-text)]">
                This project has been and will be a personal project for me, so I am limited on what little time I have to contribute. However, this is why it is open source- feel free to contribute if you have suggestions or want to help out! I also hope that this project can be a useful reference for others looking to build similar tools in other cities or with other datasets.
            </p>



<div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => window.open("https://github.com/twotoque/torontoCensusVisualizer2", "_blank")}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition hover:bg-[var(--accent-hover)]"
                >
                  View Github Repository 
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => window.open("https://docs.google.com/document/d/1SNGPiXUhtpM14wsuH2g4CMaPnX8PJAeJI8bSigpDG-w/edit?usp=sharing", "_blank")}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow)] transition hover:bg-[var(--surface-alt)]"
                >
                  View White Paper
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => window.open("https://huggingface.co/twotoque/query-parser", "_blank")}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface)]"
                >
                  View HuggingFace ML Repository
                </button>
                </div>


      </section>
    </div>
    </>
  );
};
