import {
  ArrowLeft,
  BookOpen,
  Calculator,
  RefreshCw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { NailedItCalculators } from "../components/NailedItCalculators";
import { NailedItConvert } from "../components/NailedItConvert";
import { nailedItGlossaryTerms } from "../data/nailedItGlossary";

type NailedItView = "calc" | "convert" | "glossary";

const glossaryCategories = [
  "All",
  "Framing",
  "Concrete",
  "Roofing",
  "Electrical",
  "Plumbing",
  "General",
] as const;

type GlossaryCategory =
  (typeof glossaryCategories)[number];

export function NailedItPage() {
  const [view, setView] =
    useState<NailedItView>("calc");
  const [glossarySearch, setGlossarySearch] =
    useState("");
  const [glossaryCategory, setGlossaryCategory] =
    useState<GlossaryCategory>("All");

  const normalizedSearch =
    glossarySearch.trim().toLowerCase();

  const filteredGlossary = nailedItGlossaryTerms.filter(
    (item) => {
      const matchesCategory =
        glossaryCategory === "All" ||
        item.category === glossaryCategory;

      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.term.toLowerCase().includes(normalizedSearch) ||
        item.definition
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    },
  );

  return (
    <main className="nailed-it">
      <header className="nailed-it-header">
        <div className="nailed-it-header-top">
          <Link
            className="nailed-it-back"
            to="/app/field"
          >
            <ArrowLeft aria-hidden="true" />
            Field Mode
          </Link>

          <strong>NAILED-IT</strong>
        </div>

        <span>Calc · Convert · Glossary</span>
        <div className="nailed-it-ticks" />
      </header>

      <section className="nailed-it-content">
        {view === "calc" ? (
          <NailedItCalculators />
        ) : null}

        {view === "convert" ? (
          <NailedItConvert />
        ) : null}

        {view === "glossary" ? (
          <>
            <header className="nailed-it-section-header">
              <strong>Glossary</strong>
              <span>Search or filter by trade.</span>
            </header>

            <label className="nailed-it-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={glossarySearch}
                placeholder="Search a term…"
                onChange={(event) =>
                  setGlossarySearch(event.target.value)
                }
              />
            </label>

            <div className="nailed-it-chip-row">
              {glossaryCategories.map((category) => (
                <button
                  key={category}
                  className={
                    glossaryCategory === category
                      ? "active"
                      : undefined
                  }
                  type="button"
                  onClick={() =>
                    setGlossaryCategory(category)
                  }
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="nailed-it-glossary-list">
              {filteredGlossary.length === 0 ? (
                <p className="nailed-it-glossary-empty">
                  No terms match that search.
                </p>
              ) : (
                filteredGlossary.map((item) => (
                  <article
                    className="nailed-it-term-card"
                    key={`${item.category}:${item.term}`}
                  >
                    <header>
                      <strong>{item.term}</strong>
                      <span>{item.category}</span>
                    </header>

                    <p>{item.definition}</p>
                  </article>
                ))
              )}
            </div>
          </>
        ) : null}
      </section>

      <nav
        className="nailed-it-nav"
        aria-label="Nailed-It"
      >
        <button
          className={view === "calc" ? "active" : undefined}
          type="button"
          onClick={() => setView("calc")}
        >
          <Calculator aria-hidden="true" />
          <span>Calc</span>
        </button>

        <button
          className={
            view === "convert" ? "active" : undefined
          }
          type="button"
          onClick={() => setView("convert")}
        >
          <RefreshCw aria-hidden="true" />
          <span>Convert</span>
        </button>

        <button
          className={
            view === "glossary" ? "active" : undefined
          }
          type="button"
          onClick={() => setView("glossary")}
        >
          <BookOpen aria-hidden="true" />
          <span>Glossary</span>
        </button>
      </nav>
    </main>
  );
}
