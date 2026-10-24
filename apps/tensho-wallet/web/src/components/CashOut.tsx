import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { usePreparedFlow } from "../hooks.ts";
import { signedCents, tokenAmount, usd } from "../format.ts";
import type { OrderDetail, PreparedOrder } from "../types.ts";
import { HoldButton } from "./BeforeYouBuy.tsx";
import { AssetTile, Button, Label, Mono, Spinner, type SettlementState } from "./ui.tsx";

const ORDER_TERMINAL = ["complete", "failed", "canceled"] as const;

export interface CashOutItem {
  assetId: string;
  symbol: string;
  name: string;
  icon: string | null;
  qty: string;
  // What these coins cost, when we have the buy; null if they arrived some other way.
  cost: number | null;
}

interface RowState {
  ready: boolean;
  usdOut: number | null;
  flow: SettlementState | null;
  error: string | null;
}

// One sell-everything order per coin; each is a real True Markets quote that only executes on the hold.
function CashOutRow({
  item,
  onState,
  confirms,
}: {
  item: CashOutItem;
  onState: (symbol: string, state: RowState) => void;
  confirms: MutableRefObject<Record<string, () => void>>;
}) {
  const { quote, settlement, flow, executeError, canConfirm, confirm } = usePreparedFlow<"order_id", PreparedOrder, OrderDetail>({
    path: "/api/orders",
    idKey: "order_id",
    body: { asset_id: item.assetId, side: "sell", amount: item.qty },
    ready: true,
    terminal: ORDER_TERMINAL,
    success: "complete",
    refresh: true,
  });
  confirms.current[item.symbol] = confirm;

  const q = quote.data?.quote;
  const usdOut = q ? Number(q.qty_out) : null;
  const error = executeError?.message ?? quote.error?.message ?? (flow === "failed" ? (settlement.data?.failure_reason ?? "Sale failed.") : null);
  useEffect(() => onState(item.symbol, { ready: canConfirm, usdOut, flow, error }), [item.symbol, canConfirm, usdOut, flow, error, onState]);

  const lockedIn = usdOut !== null && item.cost !== null ? usdOut - item.cost : null;
  return (
    <div className="flex items-center gap-3 border-b border-line py-3">
      <AssetTile symbol={item.symbol} icon={item.icon} size={34} />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-bold">Sell all {item.name}</span>
        <Mono className="text-xs text-muted">{tokenAmount(item.qty, item.symbol)}</Mono>
      </span>
      <span className="flex flex-col items-end gap-0.5 text-right">
        {flow === "succeeded" ? (
          <span className="text-sm font-bold text-up">Sold</span>
        ) : flow === "signing" || flow === "pending" ? (
          <span className="text-sm text-muted">Selling…</span>
        ) : error ? (
          <span className="max-w-[180px] text-xs text-down">{error}</span>
        ) : usdOut === null ? (
          <span className="text-sm text-muted">Getting price…</span>
        ) : (
          <Mono className="text-sm">≈ {usd(usdOut)}</Mono>
        )}
        {lockedIn !== null && !error && flow !== "succeeded" && (
          <Mono className={`text-xs ${lockedIn < 0 ? "text-down" : lockedIn > 0 ? "text-up" : "text-muted"}`}>{signedCents(lockedIn)} vs. what you paid</Mono>
        )}
      </span>
    </div>
  );
}

export function CashOut({ items, onClose }: { items: CashOutItem[]; onClose: () => void }) {
  const [states, setStates] = useState<Record<string, RowState>>({});
  const confirms = useRef<Record<string, () => void>>({});
  const [sent, setSent] = useState<string[]>([]);
  const started = sent.length > 0;
  const onState = useRef((symbol: string, state: RowState) => setStates((prev) => ({ ...prev, [symbol]: state }))).current;

  const rows = items.map((i) => states[i.symbol]);
  const sellable = items.filter((i) => states[i.symbol]?.ready);
  const pricing = rows.some((s) => !s || (s.usdOut === null && !s.error));
  const busy = rows.some((s) => s?.flow === "signing" || s?.flow === "pending");
  const finished = started && !busy && sent.every((symbol) => states[symbol]?.flow !== null || states[symbol]?.error);
  const total = sellable.reduce((sum, i) => sum + (states[i.symbol]?.usdOut ?? 0), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function sellAll() {
    setSent(sellable.map((i) => i.symbol));
    for (const i of sellable) confirms.current[i.symbol]?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm" onMouseDown={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cash out"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-[16px] border border-edge bg-panel p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-[20px] leading-none font-bold">Cash out</h2>
          <p className="m-0 text-[13px] text-muted">Sells at the live price. The dollars land in your wallet as USDC.</p>
        </div>

        <div className="flex flex-col">
          {items.map((item) => (
            <CashOutRow key={item.symbol} item={item} onState={onState} confirms={confirms} />
          ))}
        </div>

        {!started && (
          <div className="flex items-baseline justify-between">
            <Label>You get about</Label>
            <Mono className="text-[28px] font-medium tracking-[-0.03em]">{pricing ? "—" : usd(total)}</Mono>
          </div>
        )}

        {finished ? (
          <Button onClick={onClose} className="h-[50px]">
            Done
          </Button>
        ) : busy ? (
          <Spinner label="Selling on True Markets…" />
        ) : (
          <>
            <HoldButton label={`Hold to cash out ${usd(total)}`} disabled={pricing || sellable.length === 0 || started} onComplete={sellAll} />
            <Button variant="secondary" className="h-10" onClick={onClose}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
