import { useState } from "react";
import { useMarket } from "../api.ts";
import { Page } from "../components/AppShell.tsx";
import { cents, Chips, DollarInput, TokenSelect, twoColumns, useTokenChoice } from "../components/Pickers.tsx";
import { Banner, Card, Label, Mono, Spinner, Stat, TextButton } from "../components/ui.tsx";
import { isPositiveDecimal } from "../format.ts";
import { swingSummary, type DailyMove } from "../swing.ts";

const AMOUNT_CHIPS = ["10", "20", "50"] as const;

function MoveBars({ moves, amount }: { moves: DailyMove[]; amount: number }) {
  const largest = Math.max(...moves.map((m) => Math.abs(m.change * amount)), 0.01);
  return (
    <div className="flex flex-col gap-2">
      <div style={{ position: "relative", display: "flex", gap: 3, height: 200 }}>
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "var(--color-edge)" }} />
        {moves.map((m) => {
          const dollars = m.change * amount;
          const height = `${(Math.abs(dollars) / largest) * 50}%`;
          const up = dollars >= 0;
          return (
            <div key={m.day} style={{ position: "relative", flex: 1 }} title={`${m.day}: ${up ? "+" : "-"}${cents(Math.abs(dollars))}`}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  borderRadius: 2,
                  background: up ? "var(--color-up)" : "var(--color-down)",
                  ...(up ? { bottom: "50%", height } : { top: "50%", height }),
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-faint">
        <span>{moves[0]?.day}</span>
        <span>Each bar is one day's gain or loss on your amount</span>
        <span>{moves.at(-1)?.day}</span>
      </div>
    </div>
  );
}

export function SwingCheck() {
  const { tokens, token, setAssetId, error } = useTokenChoice();
  const [amount, setAmount] = useState("20");
  const market = useMarket(token?.asset_id, "1M");

  const value = isPositiveDecimal(amount) ? Number(amount) : 0;
  const points = market.data && token && market.data.symbol === token.symbol ? market.data.points : [];
  const summary = swingSummary(points, value);
  const shown = cents(value);

  return (
    <Page title="Swing Check" subtitle="See how much your money could move in a day, in dollars.">
      {error && <Banner tone="error">{error.message}</Banner>}
      {!token ? (
        <Spinner />
      ) : (
        <div className="flex-1" style={twoColumns(360)}>
          <Card className="flex flex-col gap-5 p-6">
            <DollarInput label="If I put in" value={amount} onChange={setAmount} />
            <Chips
              label="Amount"
              options={AMOUNT_CHIPS}
              value={AMOUNT_CHIPS.find((c) => c === amount) ?? null}
              onChange={setAmount}
              render={(c) => `$${c}`}
            />
            <TokenSelect tokens={tokens} value={token.asset_id} onChange={setAssetId} />
            <p className="m-0 text-xs leading-relaxed text-faint">
              Nothing is bought on this screen. We use the last 30 days of {token.symbol} prices from True Markets.
            </p>
          </Card>

          <Card className="flex flex-col gap-6 p-6">
            {market.isPending ? (
              <Spinner label="Loading 30 days of prices" />
            ) : market.error || !summary ? (
              value > 0 ? (
                <Banner tone="error">
                  Price data unavailable, try again. <TextButton onClick={() => void market.refetch()}>Try again</TextButton>
                </Banner>
              ) : (
                <p className="m-0 text-muted">Enter an amount to see how much it could move.</p>
              )
            ) : (
              <>
                <p className="m-0 max-w-[40ch] text-[26px] leading-[1.25] font-bold tracking-[-0.02em]">
                  On a normal day, your {shown} moves about {cents(summary.typicalUsd)} up or down.{" "}
                  <span className="text-muted">
                    {summary.worstChange < 0
                      ? `On the worst day this month, your ${shown} would have dropped to ${cents(summary.worstValueUsd)}.`
                      : `It didn't have a down day this month, so your ${shown} would still be worth ${cents(summary.worstValueUsd)}.`}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <Stat label="Normal day" value={`± ${cents(summary.typicalUsd)}`} detail="typical move, up or down" />
                  <Stat
                    label="Worst day"
                    value={cents(summary.worstValueUsd)}
                    detail={`${summary.worstDay} · ${(summary.worstChange * 100).toFixed(1)}%`}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Label>Last {summary.moves.length} days on {shown}</Label>
                  <MoveBars moves={summary.moves} amount={value} />
                </div>
                <Mono className="text-xs text-faint">
                  Typical move = median daily change. Past swings don't promise future ones.
                </Mono>
              </>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}
