// Provides the custom-figure store and a way to open the create/edit form from
// anywhere (figure list, figure detail, routine editor).
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { emptyCustom, useCustomFigures, type CustomApi, type CustomFigure } from "../customFigures";
import { CustomFigureForm } from "./CustomFigureForm";

interface FormRequest {
  initial: CustomFigure;
  lockDance?: boolean;
  onSaved?: (c: CustomFigure) => void;
  onDeleted?: () => void;
  editing: boolean;
}

interface Ctx {
  api: CustomApi;
  /** Open the form for a new figure of the given dance. */
  create: (dance: string, opts?: { lockDance?: boolean; onSaved?: (c: CustomFigure) => void }) => void;
  /** Open the form for an existing custom figure. */
  edit: (id: string, opts?: { onDeleted?: () => void }) => void;
}

const CustomCtx = createContext<Ctx | null>(null);

export function CustomFigureHost({ children }: { children: ReactNode }) {
  const api = useCustomFigures();
  const [req, setReq] = useState<FormRequest | null>(null);

  const create: Ctx["create"] = useCallback((dance, opts) => {
    setReq({ initial: emptyCustom(dance), editing: false, ...opts });
  }, []);

  const edit: Ctx["edit"] = useCallback(
    (id, opts) => {
      const c = api.get(id);
      if (c) setReq({ initial: c, editing: true, lockDance: false, ...opts });
    },
    [api],
  );

  return (
    <CustomCtx.Provider value={{ api, create, edit }}>
      {children}
      {req && (
        <CustomFigureForm
          key={req.initial.id}
          initial={req.initial}
          lockDance={req.lockDance}
          onCancel={() => setReq(null)}
          onSave={(c) => {
            api.save(c);
            req.onSaved?.(c);
            setReq(null);
          }}
          onDelete={
            req.editing
              ? () => {
                  api.remove(req.initial.id);
                  req.onDeleted?.();
                  setReq(null);
                }
              : undefined
          }
        />
      )}
    </CustomCtx.Provider>
  );
}

export function useCustom(): Ctx {
  const v = useContext(CustomCtx);
  if (!v) throw new Error("useCustom must be used inside CustomFigureHost");
  return v;
}
