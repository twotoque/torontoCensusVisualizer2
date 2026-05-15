import React from "react";

const updates = [
  {
    title: "New feature 1",
    body: "Add a short description of the first feature here.",
  },
  {
    title: "New feature 2",
    body: "Use this space for another release note or product update.",
  },
  {
    title: "New feature 3",
    body: "You can keep adding cards or replace these with your own sections.",
  },
];

export const WhatsNew: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)] text-[var(--text)]">
      <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Introducing Toronto Census Visualizer 2.0
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
           Toronto Census Visualizer 2.0 transforms census data into an neighbourhood interactive analyst. Council staff and residents can ask questions, see citywide trends, and peek into future scenarios without writing code. 
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-start">
          <div className="space-y-4">
            {updates.map(update => (
              <article
                key={update.title}
                className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
              >
                <h2 className="text-xl font-semibold">{update.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{update.body}</p>
              </article>
            ))}
          </div>

          <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold">Notes</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              This is a placeholder panel for release date, version number, links, or any other
              info you want to keep alongside the update list.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                <div className="text-sm font-medium">Version</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">Add version info here</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                <div className="text-sm font-medium">Date</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">Add a release date here</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                <div className="text-sm font-medium">Links</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  Add links to docs, issues, or a changelog here
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};
