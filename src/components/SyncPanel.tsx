// Sync of routines across devices: sign-in by e-mail link, automatic sync after
// changes, on start and when the page comes back to the foreground.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useI18n } from "../i18n";
import type { RoutinesApi } from "../routines";
import { SYNC_ENABLED, getSession, onAuthChange, sendLink, signOut, syncNow } from "../sync";
import { useCustom } from "./CustomFigureHost";

type Status = "idle" | "syncing" | "ok" | "error";

export interface SyncState {
  enabled: boolean;
  session: Session | null;
  status: Status;
  error: string;
  lastSync: number | null;
  sync: () => void;
}

/** Keeps the routines in sync while signed in (used once, in App). */
export function useSync(api: RoutinesApi): SyncState {
  const custom = useCustom().api;
  const setRoutines = api.setAll;
  const setCustom = custom.setAll;
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const busy = useRef(false);
  const lastPushed = useRef("");
  const latest = useRef({ routines: api.routines, customFigures: custom.list });
  latest.current = { routines: api.routines, customFigures: custom.list };

  useEffect(() => {
    if (!SYNC_ENABLED) return;
    let off: (() => void) | undefined;
    getSession().then(setSession).catch(() => {});
    onAuthChange(setSession).then((u) => (off = u)).catch(() => {});
    return () => off?.();
  }, []);

  const sync = useCallback(async () => {
    if (!SYNC_ENABLED || !session || busy.current) return;
    busy.current = true;
    setStatus("syncing");
    try {
      const merged = await syncNow(latest.current);
      lastPushed.current = JSON.stringify([merged.routines, merged.customFigures]);
      if (JSON.stringify(latest.current.routines) !== JSON.stringify(merged.routines)) setRoutines(merged.routines);
      if (JSON.stringify(latest.current.customFigures) !== JSON.stringify(merged.customFigures)) setCustom(merged.customFigures);
      setStatus("ok");
      setError("");
      setLastSync(Date.now());
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  }, [session, setRoutines, setCustom]);

  // on sign-in, and whenever the page comes back to the foreground
  useEffect(() => {
    if (!session) return;
    sync();
    const onVis = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [session?.user.id]);

  // a few seconds after a local change
  useEffect(() => {
    if (!session) return;
    if (JSON.stringify([api.routines, custom.list]) === lastPushed.current) return;
    const id = setTimeout(sync, 2500);
    return () => clearTimeout(id);
  }, [api.routines, custom.list, session, sync]);

  return { enabled: SYNC_ENABLED, session, status, error, lastSync, sync };
}

/** Sign-in / status box on the routines page. */
export function SyncPanel({ state }: { state: SyncState }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  if (!state.enabled) return null;
  if (!state.session)
    return (
      <section className="card sync-panel">
        <h3>{t("syncTitle")}</h3>
        <p className="small muted">{t("syncIntro")}</p>
        {sent ? (
          <p className="small">{t("syncLinkSent", { email })}</p>
        ) : (
          <form
            className="filter-row"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr("");
              try {
                await sendLink(email.trim());
                setSent(true);
              } catch (x) {
                setErr(x instanceof Error ? x.message : String(x));
              }
            }}
          >
            <label className="field grow">
              <span>{t("syncEmail")}</span>
              <input type="email" required value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn primary" type="submit">
              {t("syncSendLink")}
            </button>
          </form>
        )}
        {err && <p className="small error">{err}</p>}
      </section>
    );
  const time = state.lastSync ? new Date(state.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <section className="card sync-panel compact">
      <span className="small">
        {state.status === "syncing"
          ? t("syncBusy")
          : state.status === "error"
            ? `${t("syncError")}: ${state.error}`
            : state.lastSync
              ? t("syncDone", { time })
              : t("syncOn")}
      </span>
      <span className="small muted">{state.session.user.email}</span>
      <button className="btn small" onClick={state.sync} disabled={state.status === "syncing"}>
        ⟳ {t("syncNow")}
      </button>
      <button className="btn small" onClick={() => signOut()}>
        {t("syncSignOut")}
      </button>
    </section>
  );
}
