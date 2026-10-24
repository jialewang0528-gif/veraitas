import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { api } from "../api.ts";
import { useBeginnerMode } from "../beginner.tsx";

// In Beginner Mode a labeled value can be tapped; the agent explains it in one or two sentences.
export function Explainable({
  label,
  value,
  context,
  children,
  align = "left",
}: {
  label: string;
  value: string;
  context: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const { beginner } = useBeginnerMode();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  const explain = useQuery({
    queryKey: ["explain", label, value, context],
    queryFn: () =>
      api<{ text: string }>("/api/agent/explain", {
        method: "POST",
        body: { label, value, context },
      }),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) =>
      !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!beginner) return <>{children}</>;

  return (
    <span ref={root} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={`Explain ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="cursor-help border-none bg-transparent p-0 text-left text-inherit decoration-faint decoration-dotted underline-offset-4 hover:underline"
      >
        {children}
      </button>
      {open && (
        <span
          id={popoverId}
          role="dialog"
          aria-label={`${label} explained`}
          className={`absolute top-full z-30 mt-2 flex w-[260px] flex-col gap-1.5 rounded-[12px] border border-edge bg-panel p-3.5 text-left shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-muted uppercase">
            <Sparkles aria-hidden className="size-3" />
            {label}
          </span>
          <span className="text-[13px] leading-snug font-normal tracking-normal text-text normal-case">
            {explain.isFetching ? (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                Explaining
              </span>
            ) : explain.data ? (
              explain.data.text
            ) : (
              "Explanation unavailable."
            )}
          </span>
        </span>
      )}
    </span>
  );
}
