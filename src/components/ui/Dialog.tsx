"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, Trash2, XCircle } from "lucide-react";

// Popups do site no lugar do confirm()/alert() do navegador.
// Uso: const dialog = useDialog(); if (await dialog.confirm({ ... })) { ... }

type Tone = "danger" | "warning" | "info" | "success";

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
}

interface AlertOptions {
  title: string;
  message?: React.ReactNode;
  tone?: Tone;
  buttonText?: string;
}

interface DialogState {
  kind: "confirm" | "alert";
  title: string;
  message?: React.ReactNode;
  confirmText: string;
  cancelText: string;
  tone: Tone;
  resolve: (value: boolean) => void;
}

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  /** Atalho para mostrar a mensagem de um erro capturado. */
  error: (err: unknown, title?: string) => Promise<void>;
}

const DialogContext = createContext<DialogApi | null>(null);

const TONES: Record<Tone, { icon: typeof Info; iconClass: string; ring: string; button: string }> = {
  danger: { icon: Trash2, iconClass: "text-red-400 bg-red-500/10 border-red-500/30", ring: "border-red-500/40", button: "bg-red-600 hover:bg-red-500" },
  warning: { icon: AlertTriangle, iconClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", ring: "border-yellow-500/30", button: "bg-yellow-600 hover:bg-yellow-500" },
  info: { icon: Info, iconClass: "text-purple-300 bg-purple-500/10 border-purple-500/30", ring: "border-purple-500/40", button: "bg-purple-600 hover:bg-purple-500" },
  success: { icon: CheckCircle2, iconClass: "text-green-400 bg-green-500/10 border-green-500/30", ring: "border-green-500/30", button: "bg-green-600 hover:bg-green-500" },
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        setDialog({
          kind: "confirm",
          title: o.title,
          message: o.message,
          confirmText: o.confirmText ?? "Confirmar",
          cancelText: o.cancelText ?? "Cancelar",
          tone: o.tone ?? "info",
          resolve,
        })
      ),
    []
  );

  const alert = useCallback((input: AlertOptions | string) => {
    const o = typeof input === "string" ? { title: input } : input;
    return new Promise<void>((resolve) =>
      setDialog({
        kind: "alert",
        title: o.title,
        message: o.message,
        confirmText: o.buttonText ?? "Ok",
        cancelText: "",
        tone: o.tone ?? "info",
        resolve: () => resolve(),
      })
    );
  }, []);

  const error = useCallback(
    (err: unknown, title = "Algo deu errado") =>
      alert({ title, message: err instanceof Error ? err.message : String(err), tone: "danger" }),
    [alert]
  );

  const close = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  // Esc cancela, Enter confirma; foco vai para o botão principal
  useEffect(() => {
    if (!dialog) return;
    confirmButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const tone = dialog ? TONES[dialog.tone] : null;
  const Icon = dialog?.kind === "alert" && dialog.tone === "danger" ? XCircle : tone?.icon ?? Info;

  return (
    <DialogContext.Provider value={{ confirm, alert, error }}>
      {children}
      {dialog && tone && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              className={`w-full max-w-md rounded-2xl border ${tone.ring} bg-[#101014] p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] animate-scale-up not-italic`}
            >
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-11 h-11 rounded-full border flex items-center justify-center ${tone.iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <h2 id="dialog-title" className="text-lg font-black text-white leading-snug">{dialog.title}</h2>
                  {dialog.message && <div className="mt-2 text-sm text-gray-400 leading-relaxed break-words">{dialog.message}</div>}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                {dialog.kind === "confirm" && (
                  <button
                    onClick={() => close(false)}
                    className="px-5 py-2.5 rounded-lg font-bold text-sm text-gray-300 bg-white/5 hover:bg-white/10 border border-gray-800 transition-colors"
                  >
                    {dialog.cancelText}
                  </button>
                )}
                <button
                  ref={confirmButtonRef}
                  onClick={() => close(true)}
                  className={`px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-colors ${tone.button}`}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog precisa estar dentro do DialogProvider");
  return ctx;
}
