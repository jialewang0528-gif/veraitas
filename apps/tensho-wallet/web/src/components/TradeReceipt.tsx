import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { tokenAmount, usd } from "../format.ts";
import type { OrderDetail } from "../types.ts";
import { DetailRow } from "./ui.tsx";

function cents(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Beginner Mode: the receipt pops up the moment a trade fills, built from the fill True Markets reports.
export function TradeReceipt({
  order,
  symbol,
  chartPrice,
  onClose,
}: {
  order: OrderDetail;
  symbol: string;
  chartPrice: number | null;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const buy = order.side === "buy";
  const qty = Number(order.executed_qty);
  const price = Number(order.executed_vwap);
  const total = qty * price;
  // What the fill cost (or lost, on a sell) against the chart price at the same moment.
  const hidden = chartPrice && chartPrice > 0 && qty > 0 ? (buy ? total - qty * chartPrice : qty * chartPrice - total) : null;

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="page-enter flex w-[380px] flex-col gap-4 rounded-[18px] border border-edge bg-panel p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 aria-hidden className="size-6 text-up" />
            <h2 id="receipt-title" className="m-0 font-display text-[20px] leading-none font-bold">
              Receipt
            </h2>
          </div>
          <button
            ref={close}
            type="button"
            aria-label="Close receipt"
            onClick={onClose}
            className="flex cursor-pointer border-none bg-transparent p-0 text-muted hover:text-text"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <p className="m-0 text-sm text-muted">
          {buy ? "Bought" : "Sold"} {tokenAmount(qty, symbol)} for {cents(total)}.
        </p>
        <div className="rounded-[14px] border border-edge bg-ink px-4 py-0.5">
          <DetailRow label={buy ? "You paid" : "You got"} value={cents(total)} />
          <DetailRow label={buy ? "You got" : "You sold"} value={tokenAmount(qty, symbol)} />
          <DetailRow label="Your price" value={`${usd(price)} / ${symbol}`} />
          <DetailRow label="Chart price" value={chartPrice ? `${usd(chartPrice)} / ${symbol}` : "Unavailable"} />
          <DetailRow
            label="Hidden cost"
            value={hidden === null ? "Unavailable" : hidden < 0.005 ? "$0.00" : cents(hidden)}
          />
          <DetailRow label="Network fee" value="Covered" last />
        </div>
        <div className="flex items-center justify-between">
          {order.explorer_url ? (
            <a href={order.explorer_url} target="_blank" rel="noreferrer" className="text-sm">
              View on explorer
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-full border border-accent bg-accent px-5 text-[12px] font-bold tracking-[0.12em] text-white uppercase hover:bg-accent-strong"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
