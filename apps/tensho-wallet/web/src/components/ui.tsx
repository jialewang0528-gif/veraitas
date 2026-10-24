import { AlertTriangle, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { percent } from "../format.ts";

type Variant = "primary" | "secondary";

const BUTTON_BASE =
  "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border px-6 text-[12px] font-bold tracking-[0.14em] uppercase no-underline transition-[background-color,color,border-color,transform] duration-200 ease-[var(--ease-out)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

// Primary is an ink fill that empties on hover; secondary is an outline that fills. Same move as the portfolio.
const BUTTON_VARIANT: Record<Variant, string> = {
  primary: "border-accent bg-accent text-white hover:border-accent-strong hover:bg-accent-strong",
  secondary: "border-edge bg-transparent text-text hover:border-accent hover:bg-accent/15",
};

function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: LinkProps & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border-none bg-transparent p-0 font-bold text-text underline decoration-1 underline-offset-4 hover:text-muted"
    >
      {children}
    </button>
  );
}

export function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between py-3 text-sm ${last ? "" : "border-b border-line"}`}>
      <span className="text-muted">{label}</span>
      <Mono>{value}</Mono>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-[14px] border border-edge bg-panel ${className}`}>{children}</section>;
}

export function Mono({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`font-mono tabular-nums ${className}`}>{children}</span>;
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="text-[11px] leading-[14px] font-bold tracking-[0.14em] text-muted uppercase">{children}</span>;
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Mono className="text-[30px] font-medium tracking-[-0.03em]">{value}</Mono>
      {detail && <Mono className="text-sm text-muted">{detail}</Mono>}
    </div>
  );
}

export function Banner({
  tone = "warning",
  title,
  children,
}: {
  tone?: "warning" | "error";
  title?: string;
  children: ReactNode;
}) {
  const palette =
    tone === "warning"
      ? "border-warn-edge bg-warn-bg text-warn-text"
      : "border-down/40 bg-down/10 text-text";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3.5 rounded-[14px] border px-5 py-4 ${palette}`}>
      <AlertTriangle aria-hidden strokeWidth={1.5} className={`mt-0.5 size-5 shrink-0 ${tone === "warning" ? "text-amber" : "text-down"}`} />
      <div className="flex flex-col gap-1 text-sm leading-relaxed">
        {title && <span className={`text-[15px] font-bold ${tone === "warning" ? "text-warn-title" : ""}`}>{title}</span>}
        <span>{children}</span>
      </div>
    </div>
  );
}

const TILE_COLORS: Record<string, string> = { USDC: "bg-cyan", SOL: "bg-violet", PENGU: "bg-amber", ETH: "bg-cyan" };
const TILE_FALLBACK = ["bg-pink", "bg-cyan", "bg-violet", "bg-amber", "bg-up"];
const TILE_LABELS: Record<string, string> = { USDC: "USD", PENGU: "PG" };

function tileColor(symbol: string): string {
  const known = TILE_COLORS[symbol];
  if (known) return known;
  const hash = [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return TILE_FALLBACK[hash % TILE_FALLBACK.length]!;
}

// Token logos keep their own colors: they are the one place hue belongs in this monochrome app.
export function AssetTile({ symbol, icon, size = 40 }: { symbol: string; icon?: string | null; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        style={style}
        className="shrink-0 bg-line object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      style={style}
      className={`flex shrink-0 items-center justify-center text-[10px] font-bold tracking-[0.04em] text-ink ${tileColor(symbol)}`}
    >
      {TILE_LABELS[symbol] ?? symbol.slice(0, 3)}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {label}
    </span>
  );
}

export function PriceChange({ ratio, className = "" }: { ratio: number | null; className?: string }) {
  const color = ratio === null || ratio === 0 ? "text-muted" : ratio > 0 ? "text-up" : "text-down";
  return <Mono className={`${color} ${className}`}>{percent(ratio)}</Mono>;
}

export type SettlementState = "signing" | "pending" | "succeeded" | "failed" | "timed_out";

export function SettlementNotice({
  state,
  success,
  failure,
  explorerUrl,
  onDone,
}: {
  state: SettlementState;
  success: string;
  failure?: string;
  explorerUrl?: string | null;
  onDone: () => void;
}) {
  if (state === "signing") return <Spinner label="Signing and submitting…" />;
  if (state === "pending") return <Spinner label="Submitted. Waiting for the network…" />;

  const outcome = {
    succeeded: { tone: "border-up/40 bg-up/10", message: success },
    failed: { tone: "border-down/40 bg-down/10", message: failure || "It didn't go through. Nothing moved." },
    timed_out: { tone: "border-warn-edge bg-warn-bg", message: "Still pending after a minute. Check Activity for the final status." },
  }[state];
  const { tone, message } = outcome;
  return (
    <div role="status" className={`flex flex-col gap-3 rounded-[14px] border px-4 py-3.5 text-sm ${tone}`}>
      <span>{message}</span>
      <div className="flex items-center justify-between">
        {explorerUrl ? (
          <a href={explorerUrl} target="_blank" rel="noreferrer">
            View on explorer
          </a>
        ) : (
          <span />
        )}
        <Button variant="secondary" className="h-9 px-4 text-sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

export function TxAmount({ amount, value, className = "" }: { amount: string; value: string | null; className?: string }) {
  return (
    <span className={`flex flex-col items-end gap-0.5 ${className}`}>
      <Mono className="text-sm">{amount}</Mono>
      {value && <Mono className="text-xs text-muted">{value}</Mono>}
    </span>
  );
}

export function TxGlyph({ glyph, color }: { glyph: string; color: string }) {
  return (
    <div className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-edge text-sm font-bold ${color}`}>
      {glyph}
    </div>
  );
}

// No logo, only the wordmark: the "AI" set heavier than the rest.
export function Wordmark({ className = "", animate = false }: { className?: string; animate?: boolean }) {
  const parts: [string, boolean][] = [
    ["Ver", false],
    ["AI", true],
    ["tas", false],
  ];
  return (
    <span role="img" aria-label="VerAItas" className={`font-display leading-none tracking-[-0.03em] ${animate ? "wordmark-in" : ""} ${className}`}>
      {parts.map(([text, heavy], i) => (
        <span key={text} aria-hidden className={heavy ? "font-extrabold text-accent" : "font-medium text-text"} style={animate ? { animationDelay: `${i * 120}ms` } : undefined}>
          {text}
        </span>
      ))}
    </span>
  );
}

export function Logo() {
  return <Wordmark className="text-[24px]" />;
}

export function GridHorizon({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <div className="dot-grid absolute inset-0" />
      <div className="sheen" />
    </div>
  );
}
