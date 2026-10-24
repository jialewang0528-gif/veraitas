import { useQuery } from "@tanstack/react-query";
import type { KeyboardEvent } from "react";
import { api, useMarket } from "../api.ts";
import { tokenAmount, usd, percent } from "../format.ts";
import { aboutToken, guideNumbers } from "../guide.ts";
import { useHold } from "../hold.ts";
import { swingSummary } from "../swing.ts";
import type { AssetRow, Quote } from "../types.ts";
import { Label, Mono } from "./ui.tsx";

type Estimate = Pick<Quote, "qty_out" | "fee" | "fee_asset">;

function useEstimate(
  path: "/api/orders/exit-quote" | "/api/orders/buy-quote",
  body: Record<string, string> | null,
) {
  return useQuery({
    queryKey: ["estimate", path, body],
    queryFn: () => api<Estimate>(path, { method: "POST", body: body! }),
    enabled: body !== null,
    refetchInterval: 10_000,
    retry: false,
  });
}

// Card amounts read in cents; anything under a cent says so instead of showing six decimals.
function money(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value > 0 && value < 0.01) return "<$0.01";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Row({
  label,
  value,
  tone = "",
  note,
}: {
  label: string;
  value: string;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="flex flex-col items-end">
        <Mono className={`text-[14px] ${tone}`}>{value}</Mono>
        {note && <span className="text-[11px] text-faint">{note}</span>}
      </span>
    </div>
  );
}

export function HoldButton({
  label,
  disabled,
  onComplete,
}: {
  label: string;
  disabled: boolean;
  onComplete: () => void;
}) {
  const hold = useHold(onComplete, disabled);
  function onKeyDown(e: KeyboardEvent) {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      hold.start();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") hold.stop();
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}. Press and hold to confirm.`}
      onPointerDown={hold.start}
      onPointerUp={hold.stop}
      onPointerLeave={hold.stop}
      onPointerCancel={hold.stop}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className="relative h-[54px] w-full cursor-pointer touch-none overflow-hidden rounded-full border border-text bg-text text-[12px] font-bold tracking-[0.14em] text-ink uppercase select-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-up"
        style={{ width: `${hold.progress * 100}%` }}
      />
      <span className="relative">
        {hold.progress > 0 ? "Keep holding" : label}
      </span>
      <span className="sr-only" aria-live="polite">
        {hold.progress > 0 ? `${Math.round(hold.progress * 100)} percent` : ""}
      </span>
    </button>
  );
}

export function BeforeYouBuy({
  token,
  spend,
  quote,
  canConfirm,
  onConfirm,
}: {
  token: AssetRow;
  spend: number;
  quote: Quote | undefined;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  const day = useMarket(token.asset_id, "1D");
  const hour = useMarket(token.asset_id, "1H");
  const month = useMarket(token.asset_id, "1M");
  // An unfunded wallet gets no executable quote, so the card falls back to an informational one.
  const preview = useEstimate(
    "/api/orders/buy-quote",
    quote ? null : { asset_id: token.asset_id, amount: String(spend) },
  );
  const live: Estimate | undefined = quote ?? preview.data;
  const exit = useEstimate(
    "/api/orders/exit-quote",
    live ? { asset_id: token.asset_id, qty: live.qty_out } : null,
  );

  const qtyOut = live ? Number(live.qty_out) : null;
  const stats = day.data?.stats;
  const n = guideNumbers({
    spend,
    qtyOut,
    marketPrice: token.price === null ? null : Number(token.price),
    sellBack: exit.data ? Number(exit.data.qty_out) : null,
    feeUsd: live?.fee_asset === "USDC" ? Number(live.fee) : null,
    low24h: stats?.low_24h ? Number(stats.low_24h) : null,
    high24h: stats?.high_24h ? Number(stats.high_24h) : null,
    hourPoints: hour.data?.symbol === token.symbol ? hour.data.points : [],
  });
  const swing =
    month.data?.symbol === token.symbol
      ? swingSummary(month.data.points, spend)
      : null;
  const fee = live
    ? live.fee_asset === "USDC"
      ? money(Number(live.fee))
      : `${tokenAmount(live.fee)} ${live.fee_asset}`
    : "Unavailable";
  const about = aboutToken(token.symbol);
  const amountLabel = usd(spend);

  return (
    <section
      aria-label="Before you buy"
      className="flex flex-col gap-3 rounded-[14px] border border-edge bg-ink p-4"
    >
      <div className="flex items-baseline justify-between">
        <Label>Before you buy</Label>
        <span className="text-[11px] text-faint">
          {amountLabel} of {token.symbol}
        </span>
      </div>
      <div className="flex flex-col">
        <Row
          label="You get"
          value={
            qtyOut ? `~${tokenAmount(qtyOut, token.symbol)}` : "Unavailable"
          }
        />
        <Row label="Fee" value={fee} />
        <Row label="Network fee" value="Covered" />
        <Row
          label="Hidden cost"
          value={money(
            n.hiddenCost === null ? null : Math.max(0, n.hiddenCost),
          )}
          note="Price paid vs. chart price"
        />
        <Row
          label="Sell-back now"
          value={n.sellBack === null ? "Unavailable" : `~${money(n.sellBack)}`}
          note={
            n.sellBackEstimated
              ? "Estimate"
              : undefined
          }
        />
        <Row
          label="Round-trip cost"
          value={money(n.roundTripCost)}
          note="Fee + spread"
        />
        <Row
          label="24h range"
          value={
            n.range24h
              ? `${usd(n.range24h[0])} – ${usd(n.range24h[1])}`
              : "Unavailable"
          }
        />
        <Row
          label="Worst day, 30d"
          value={swing ? `${usd(swing.worstValueUsd)}` : "Unavailable"}
          note={
            swing
              ? `${percent(swing.worstChange)} on ${swing.worstDay}`
              : undefined
          }
          tone={swing ? "text-down" : ""}
        />
        <Row
          label="Past hour"
          value={n.pastHour === null ? "Unavailable" : percent(n.pastHour)}
          tone={
            n.pastHour === null ? "" : n.pastHour < 0 ? "text-down" : "text-up"
          }
        />
      </div>
      {about && <p className="m-0 text-[13px] text-muted">{about}</p>}
      <p className="m-0 text-[11px] text-faint">
        Estimates. Prices change constantly.
      </p>
      <HoldButton
        label={`Hold to buy ${amountLabel} of ${token.symbol}`}
        disabled={!canConfirm}
        onComplete={onConfirm}
      />
    </section>
  );
}
