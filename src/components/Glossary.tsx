// Tap-to-explain abbreviations. <Glossed> underlines known terms in a text;
// tapping one shows its explanation in a bar at the bottom of the screen
// (works the same on touch devices, unlike a hover tooltip).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getTerm, splitTerms, type Term } from "../glossary";
import { useI18n } from "../i18n";

interface Ctx {
  show: (id: string) => void;
}

const GlossaryCtx = createContext<Ctx>({ show: () => {} });

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n();
  const [current, setCurrent] = useState<string | null>(null);
  const term = current ? getTerm(current) : undefined;

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCurrent(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  return (
    <GlossaryCtx.Provider value={{ show: setCurrent }}>
      {children}
      {term && (
        <div className="gloss-bar" role="status" aria-live="polite">
          <div className="gloss-term">{term.label}</div>
          <div className="gloss-text">{term[lang]}</div>
          <button className="icon-btn" onClick={() => setCurrent(null)} aria-label={t("close")}>
            ✕
          </button>
        </div>
      )}
    </GlossaryCtx.Provider>
  );
}

export function useGlossary() {
  return useContext(GlossaryCtx);
}

/** Render text with recognised abbreviations as tappable terms. */
export function Glossed({ text, groups }: { text: string; groups?: Term["group"][] }) {
  const { show } = useGlossary();
  const { lang } = useI18n();
  return (
    <>
      {splitTerms(text, groups).map((c, i) =>
        c.termId ? (
          <button
            key={i}
            type="button"
            className="term"
            title={getTerm(c.termId)?.[lang]}
            onClick={(e) => {
              e.stopPropagation();
              show(c.termId!);
            }}
          >
            {c.text}
          </button>
        ) : (
          <span key={i}>{c.text}</span>
        ),
      )}
    </>
  );
}
