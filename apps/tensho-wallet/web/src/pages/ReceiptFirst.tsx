import { useState } from "react";
import { isPriceMoved } from "../api.ts";
import { Page } from "../components/AppShell.tsx";
import { cents, Chips, DollarInput, TokenSelect, twoColumns, useTokenChoice } from "../components/Pickers.tsx";
import { Banner, Button, Card, DetailRow, Label, SettlementNotice, Spinner, TextButton } from "../components/ui.tsx";
import { isPositiveDecimal, tokenAmount, usd } from "../format.ts";
import { useDebounced, useNow, usePreparedFlow } from "../hooks.ts";
import type { AssetRow, OrderDetail, PreparedOrder } from "../types.ts";

const ORDER_TERMINAL = ["complete", "failed", "canceled"] as const;
const CHIPS = ["1", "2", "5"] as const;
const EXPLAINER = "When you buy, you pay what the cheapest seller asks, which sits a bit above the chart price.";

// What the gap between the chart price and your price costs you, in dollars.
function hiddenCost(spent: number, received: number, marketPrice: number): number {
  return spent - received * marketPrice;
}

function hiddenLabel(cost: number | null): string {
  if (cost === null) return "—";
  return cost < 0.005 ? "$0.00, at or better than the chart" : cents(cost);
}

function QuoteAge({ preparedAt }: { preparedAt: string }) {
  const now = useNow(1000);
  return <>Quote updated {Math.max(0, Math.round((now - Date.parse(preparedAt)) / 1000))}s ago · refreshes every 10s</>;
}

function ReceiptTicket({ token, tokens, onToken }: { token: AssetRow; tokens: AssetRow[]; onToken: (id: string) => void }) {
  const [amount, setAmount] = useState("");
  const settled = useDebounced(amount, 400);
  const { quote, settlement, flow, executeError, canConfirm, confirm, reset, retry } = usePreparedFlow<
    "order_id",
    PreparedOrder,
    OrderDetail
  >({
    path: "/api/orders",
    idKey: "order_id",
    body: { asset_id: token.asset_id, side: "buy", amount: settled },
    ready: isPositiveDecimal(settled),
    terminal: ORDER_TERMINAL,
    success: "complete",
    refresh: true,
  });

  const q = quote.data?.quote;
  const spend = Number(settled);
  const market = Number(token.price);
  const received = q ? Number(q.qty_out) : 0;
  const yourPrice = received > 0 ? spend / received : null;
  const hidden = received > 0 && market > 0 ? hiddenCost(spend, received, market) : null;

  const filled = settlement.data?.status === "complete" ? settlement.data : undefined;
  const filledQty = Number(filled?.executed_qty ?? 0);
  const filledPrice = Number(filled?.executed_vwap ?? 0);
  const paid = filledQty * filledPrice;

  function done() {
    reset();
    setAmount("");
  }

  return (
    <div className="flex-1" style={twoColumns(360)}>
      <Card className="flex flex-col gap-5 p-6">
        <DollarInput label="You pay" value={amount} onChange={setAmount} disabled={flow !== null} />
        <Chips
          label="Amount"
          options={CHIPS}
          value={CHIPS.find((c) => c === amount) ?? null}
          onChange={setAmount}
          render={(c) => `$${c}`}
          disabled={flow !== null}
        />
        <TokenSelect tokens={tokens} value={token.asset_id} onChange={onToken} disabled={flow !== null} />
        {quote.error && !executeError && <Banner tone="error">{quote.error.message}</Banner>}
        {executeError && (
          <Banner tone="error" title={isPriceMoved(executeError) ? "Price moved and nothing was bought." : undefined}>
            {isPriceMoved(executeError) ? "Review the receipt again." : executeError.message}{" "}
            <TextButton onClick={retry}>{isPriceMoved(executeError) ? "Review again" : "Try again"}</TextButton>
          </Banner>
        )}
        {flow ? (
          <SettlementNotice
            state={flow}
            success={`Bought ${tokenAmount(settlement.data?.executed_qty ?? "0", token.symbol)}. Your receipt is ready.`}
            failure={settlement.data?.status === "canceled" ? "The order was canceled. Nothing moved." : settlement.data?.failure_reason}
            explorerUrl={settlement.data?.explorer_url}
            onDone={done}
          />
        ) : (
          <Button className="h-[54px] rounded-2xl text-base" disabled={!canConfirm || amount !== settled} onClick={confirm}>
            I've read the receipt, buy
          </Button>
        )}
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 font-display text-[22px] leading-none font-bold">Receipt before you buy</h2>
            <Label>{token.symbol}</Label>
          </div>
          <div className="rounded-[14px] border border-edge bg-ink px-4 py-0.5">
            <DetailRow label="You pay" value={spend > 0 ? cents(spend) : "—"} />
            <DetailRow label="Market price" value={market > 0 ? `${usd(market)} / ${token.symbol}` : "—"} />
            <DetailRow label="Your price" value={yourPrice === null ? "—" : `${usd(yourPrice)} / ${token.symbol}`} />
            <DetailRow label="You get" value={q ? tokenAmount(q.qty_out, token.symbol) : "—"} />
            {q && Number(q.fee) > 0 && <DetailRow label="Fee" value={`${tokenAmount(q.fee)} ${q.fee_asset}`} />}
            <DetailRow label="Hidden cost" value={hiddenLabel(hidden)} last />
          </div>
          <p className="m-0 text-sm text-muted">{EXPLAINER}</p>
          <p className="m-0 text-xs text-faint">
            {quote.data ? (
              <QuoteAge preparedAt={quote.data.prepared_at} />
            ) : quote.isFetching ? (
              "Getting a quote…"
            ) : (
              "Enter an amount to see your receipt."
            )}
          </p>
        </Card>

        {filled && (
          <Card className="flex flex-col gap-4 p-6">
            <h2 className="m-0 font-display text-[22px] leading-none font-bold">Your receipt</h2>
            <div className="rounded-[14px] border border-up/40 bg-ink px-4 py-0.5">
              <DetailRow label="You paid" value={cents(paid)} />
              <DetailRow label="You got" value={tokenAmount(filled.executed_qty, token.symbol)} />
              <DetailRow label="Your price" value={`${usd(filledPrice)} / ${token.symbol}`} />
              <DetailRow label="Market price now" value={market > 0 ? `${usd(market)} / ${token.symbol}` : "—"} />
              <DetailRow label="Hidden cost" value={hiddenLabel(market > 0 ? hiddenCost(paid, filledQty, market) : null)} last />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export function ReceiptFirst() {
  const { tokens, token, setAssetId, error } = useTokenChoice();
  return (
    <Page title="Receipt First" subtitle="See the full cost before your money moves.">
      {error && <Banner tone="error">{error.message}</Banner>}
      {!token ? <Spinner /> : <ReceiptTicket key={token.asset_id} token={token} tokens={tokens} onToken={setAssetId} />}
    </Page>
  );
}
