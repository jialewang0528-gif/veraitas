import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, isPriceMoved, useExitPlans } from "../api.ts";
import { Page } from "../components/AppShell.tsx";
import { Chips, DollarInput, MAX_BUY_USD, TokenSelect, twoColumns, useTokenChoice } from "../components/Pickers.tsx";
import { Banner, Button, Card, DetailRow, Label, Mono, SettlementNotice, Spinner, TextButton } from "../components/ui.tsx";
import { isPositiveDecimal, tokenAmount, usd } from "../format.ts";
import { useDebounced, usePreparedFlow } from "../hooks.ts";
import type { AssetRow, ExitPlan, ExitStatus, OrderDetail, PreparedOrder } from "../types.ts";

const ORDER_TERMINAL = ["complete", "failed", "canceled"] as const;
const AMOUNT_CHIPS = ["1", "2", "5"] as const;
const TARGETS = [5, 10, 20] as const;
type Target = (typeof TARGETS)[number];

const STATUS_TEXT: Record<ExitStatus, string> = {
  watching: "Watching the price",
  selling: "Target hit, selling…",
  sold: "Sold",
  failed: "Sell failed",
  canceled: "Canceled",
};

function BuyWithPlan({ token, tokens, onToken }: { token: AssetRow; tokens: AssetRow[]; onToken: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const settled = useDebounced(amount, 400);
  const overCap = Number(settled) > MAX_BUY_USD;
  const { quote, settlement, flow, executeError, canConfirm, confirm, reset, retry } = usePreparedFlow<
    "order_id",
    PreparedOrder,
    OrderDetail
  >({
    path: "/api/orders",
    idKey: "order_id",
    body: { asset_id: token.asset_id, side: "buy", amount: settled },
    ready: isPositiveDecimal(settled) && !overCap,
    terminal: ORDER_TERMINAL,
    success: "complete",
    refresh: true,
  });

  const createPlan = useMutation({
    mutationFn: (body: { order_id: string; target_pct: Target }) =>
      api<ExitPlan>("/api/exit-plans", { method: "POST", body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["exit-plans"] }),
  });

  // Once the buy fills, save the sell plan exactly once for that order.
  const filled = settlement.data?.status === "complete" ? settlement.data : undefined;
  const planned = useRef<string | null>(null);
  useEffect(() => {
    if (!filled || target === null || planned.current === filled.order_id) return;
    planned.current = filled.order_id;
    createPlan.mutate({ order_id: filled.order_id, target_pct: target });
  }, [filled, target, createPlan]);

  const q = quote.data?.quote;
  const estPrice = q && Number(q.qty_out) > 0 ? Number(settled) / Number(q.qty_out) : null;
  const plan = createPlan.data;

  function done() {
    reset();
    createPlan.reset();
    planned.current = null;
    setAmount("");
    setTarget(null);
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <DollarInput label="You buy" value={amount} onChange={setAmount} disabled={flow !== null} />
      <Chips
        label="Amount"
        options={AMOUNT_CHIPS}
        value={AMOUNT_CHIPS.find((c) => c === amount) ?? null}
        onChange={setAmount}
        render={(c) => `$${c}`}
        disabled={flow !== null}
      />
      <TokenSelect tokens={tokens} value={token.asset_id} onChange={onToken} disabled={flow !== null} />

      <div className="flex flex-col gap-2">
        <Label>Sell when I'm up</Label>
        <Chips
          label="Sell target"
          options={TARGETS}
          value={target}
          onChange={setTarget}
          render={(t) => `+${t}%`}
          disabled={flow !== null}
        />
      </div>

      <div className="rounded-[14px] border border-edge bg-ink px-4 py-0.5">
        <DetailRow label="Buy price (est.)" value={estPrice === null ? "—" : `${usd(estPrice)} / ${token.symbol}`} />
        <DetailRow
          label="Sell price (est.)"
          value={estPrice === null || target === null ? "—" : `${usd(estPrice * (1 + target / 100))} / ${token.symbol}`}
          last
        />
      </div>

      {overCap && <Banner tone="warning">Buys are capped at ${MAX_BUY_USD} for now.</Banner>}
      {quote.error && !executeError && <Banner tone="error">{quote.error.message}</Banner>}
      {executeError && (
        <Banner tone="error" title={isPriceMoved(executeError) ? "Price moved and nothing was bought." : undefined}>
          {isPriceMoved(executeError) ? "Review the quote again." : executeError.message}{" "}
          <TextButton onClick={retry}>{isPriceMoved(executeError) ? "Review again" : "Try again"}</TextButton>
        </Banner>
      )}
      {createPlan.error && (
        <Banner tone="error" title="The buy went through, but the sell plan wasn't saved.">
          {createPlan.error.message}{" "}
          <TextButton onClick={() => filled && target !== null && createPlan.mutate({ order_id: filled.order_id, target_pct: target })}>
            Try again
          </TextButton>
        </Banner>
      )}
      {plan && (
        <div role="status" className="rounded-[14px] border border-up/40 bg-up/10 px-4 py-3.5 text-sm">
          You bought {tokenAmount(plan.qty, plan.symbol)} at {usd(plan.fill_price)}. We will sell automatically at{" "}
          {usd(plan.target_price)}.
        </div>
      )}

      {flow ? (
        <SettlementNotice
          state={flow}
          success={`Bought ${tokenAmount(settlement.data?.executed_qty ?? "0", token.symbol)}.`}
          failure={settlement.data?.status === "canceled" ? "The order was canceled. Nothing moved." : settlement.data?.failure_reason}
          explorerUrl={settlement.data?.explorer_url}
          onDone={done}
        />
      ) : (
        <Button
          className="h-[54px] rounded-2xl text-base"
          disabled={target === null || !canConfirm || amount !== settled}
          onClick={confirm}
        >
          {target === null ? "Pick a sell target first" : `Buy and sell at +${target}%`}
        </Button>
      )}
    </Card>
  );
}

function ExitPlans() {
  const queryClient = useQueryClient();
  const plans = useExitPlans();
  const cancel = useMutation({
    mutationFn: (id: string) => api<ExitPlan>(`/api/exit-plans/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["exit-plans"] }),
  });

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="m-0 font-display text-[22px] leading-none font-bold">Your sell plans</h2>
      {plans.isPending ? (
        <Spinner />
      ) : plans.error ? (
        <Banner tone="error">{plans.error.message}</Banner>
      ) : !plans.data.length ? (
        <p className="m-0 text-sm text-muted">No plans yet. Your first buy here creates one.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {plans.data.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 rounded-[14px] border border-edge bg-ink px-4 py-3">
              <div className="flex flex-col gap-1">
                <Mono className="text-[15px]">{tokenAmount(p.qty, p.symbol)}</Mono>
                <span className="text-xs text-muted">
                  Bought at {usd(p.fill_price)} · Sell at {usd(p.target_price)} (+{p.target_pct}%)
                </span>
                <span className={`text-xs ${p.status === "sold" ? "text-up" : p.status === "failed" ? "text-down" : "text-faint"}`}>
                  {STATUS_TEXT[p.status]}
                  {p.status === "sold" && p.sold_price ? ` at ${usd(p.sold_price)}` : ""}
                  {p.status === "failed" && p.failure ? `: ${p.failure}` : ""}
                </span>
              </div>
              {p.status === "watching" && (
                <Button
                  variant="secondary"
                  className="h-9 px-4 text-sm"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(p.id)}
                >
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {cancel.error && <Banner tone="error">{cancel.error.message}</Banner>}
      <p className="m-0 text-xs leading-relaxed text-faint">
        VerAItas checks the price every 15 seconds while the app is running and sells at market once your target is
        reached. The price can move past your target before the sale lands.
      </p>
    </Card>
  );
}

export function ExitTicket() {
  const { tokens, token, setAssetId, error } = useTokenChoice();
  return (
    <Page title="Exit Ticket" subtitle="Decide when you'll sell before you buy.">
      {error && <Banner tone="error">{error.message}</Banner>}
      {!token ? (
        <Spinner />
      ) : (
        <div className="flex-1" style={twoColumns(380)}>
          <BuyWithPlan key={token.asset_id} token={token} tokens={tokens} onToken={setAssetId} />
          <ExitPlans />
        </div>
      )}
    </Page>
  );
}
