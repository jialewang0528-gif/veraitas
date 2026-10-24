import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { api, useAssets, useMe, usePortfolio, useTransactions } from "../api.ts";
import { Page } from "../components/AppShell.tsx";
import { CashOut, type CashOutItem } from "../components/CashOut.tsx";
import { PnlChart } from "../components/PnlChart.tsx";
import { AssetTile, Banner, Button, ButtonLink, Card, GridHorizon, Label, Mono, Spinner } from "../components/ui.tsx";
import { holdings, percent, relativeTime, signedCents, tokenAmount, usd } from "../format.ts";
import { useLivePrices } from "../live.ts";
import { fills, holdingPnl, pnlSeries, positions, summarize, type PricePoint } from "../pnl.ts";
import type { ChartRange, MarketData } from "../types.ts";

const RANGES: ChartRange[] = ["1H", "1D", "1W", "1M"];
const RANGE_MS: Record<ChartRange, number> = { "1H": 3_600_000, "1D": 86_400_000, "1W": 604_800_000, "1M": 2_592_000_000 };
const HOLDING_GRID = "grid grid-cols-[1.6fr_1.3fr_0.9fr_0.9fr_0.9fr_1fr_92px] items-center gap-2";
// Allocation stays monochrome; color is reserved for up and down.
const SHADES = ["#f5f5f5", "#9a9a9a", "#5c5c5c", "#3a3a3a", "#262626"];

function tone(n: number | null): string {
  return n === null || Math.abs(n) < 0.005 ? "text-muted" : n > 0 ? "text-up" : "text-down";
}

// Open on the shortest range that still shows the first trade.
function rangeFor(firstAt: number | undefined): ChartRange {
  if (firstAt === undefined) return "1D";
  const age = Date.now() - firstAt;
  return RANGES.find((r) => age < RANGE_MS[r] * 0.95) ?? "1M";
}

export function Home() {
  const me = useMe();
  const ready = me.data?.ready ?? false;
  const portfolio = usePortfolio();
  const assets = useAssets();
  const transactions = useTransactions();
  const [picked, setPicked] = useState<ChartRange>();
  const [cashOut, setCashOut] = useState<CashOutItem[] | null>(null);

  const trades = useMemo(() => fills(transactions.data?.data), [transactions.data]);
  const book = useMemo(() => positions(trades), [trades]);
  const rows = holdings(portfolio.data, assets.data)
    .filter((h) => h.cash || Number(h.total) > 0)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const traded = [...new Set([...trades.map((f) => f.symbol), ...rows.filter((h) => !h.cash).map((h) => h.symbol)])];
  const live = useLivePrices(traded);
  const priceOf = (symbol: string, fallback: number | null) => live[symbol] ?? fallback;

  const view = rows.map((h) => {
    const price = h.cash ? 1 : priceOf(h.symbol, h.price);
    const value = price === null ? h.value : Number(h.total) * price;
    const asset = assets.data?.find((a) => a.symbol === h.symbol && a.chain === h.chain);
    return { ...h, price, value, assetId: asset?.asset_id, pnl: h.cash ? null : holdingPnl(book.get(h.symbol), Number(h.total), price) };
  });
  const total = portfolio.data ? view.reduce((sum, h) => sum + (h.value ?? 0), 0) : null;
  const held = Object.fromEntries(view.map((h) => [h.symbol, Number(h.total)]));
  const prices = Object.fromEntries(view.map((h) => [h.symbol, h.price]));
  const summary = summarize(trades, prices, held);

  const range = picked ?? rangeFor(trades[0]?.at);
  const charted = traded.flatMap((symbol) => {
    const asset = assets.data?.find((a) => a.symbol === symbol && !a.cash);
    return asset ? [{ symbol, assetId: asset.asset_id }] : [];
  });
  const histories = useQueries({
    queries: charted.map(({ symbol, assetId }) => ({
      queryKey: ["market", assetId, range],
      queryFn: () => api<MarketData>(`/api/market/${encodeURIComponent(assetId)}?range=${range}`),
      refetchInterval: range === "1H" ? 15_000 : 60_000,
      placeholderData: (previous: MarketData | undefined) => previous,
      select: (data: MarketData) => ({ symbol, points: data.points.map((p) => ({ t: Date.parse(p.t), price: Number(p.price) })) }),
    })),
  });
  const now = Date.now();
  const historyKey = histories.map((h) => h.dataUpdatedAt).join(",");
  const series = useMemo(() => {
    const history: Record<string, PricePoint[]> = {};
    for (const h of histories) if (h.data) history[h.data.symbol] = [...h.data.points, ...(live[h.data.symbol] ? [{ t: now, price: live[h.data.symbol]! }] : [])];
    return pnlSeries(trades, history, now - RANGE_MS[range], now);
  }, [trades, historyKey, live, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const chartLoading = histories.some((h) => h.isLoading);

  const coins = view.filter((h) => !h.cash && (h.value ?? 0) > 0.01);
  const allocation = view.filter((h) => (h.value ?? 0) > 0.005);
  const cashOutItem = (h: (typeof view)[number]): CashOutItem[] =>
    h.assetId ? [{ assetId: h.assetId, symbol: h.symbol, name: h.name, icon: h.icon, qty: h.available, cost: h.pnl?.avgCost != null ? h.pnl.cost : null }] : [];

  return (
    <Page title="Portfolio" subtitle="What your money is doing, live.">
      {!ready && (
        <Banner title="Your wallet is still being set up">
          Sign in again to retry.{me.data?.warning && ` (${me.data.warning})`}
        </Banner>
      )}
      {portfolio.error && <Banner tone="error">{portfolio.error.message}</Banner>}

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-5">
        <Card className="relative flex h-[318px] flex-col gap-4 overflow-hidden p-6">
          <GridHorizon />
          <div className="relative flex items-center justify-between">
            <Label>Total value</Label>
            <span className="flex items-center gap-2 text-[11px] text-faint">
              <span className="live-dot" />
              {Object.keys(live).length > 0 ? "Live prices" : "Connecting"}
            </span>
          </div>
          <div className="relative flex flex-col gap-1.5">
            <Mono className="text-[clamp(38px,4.4vw,60px)] leading-[0.95] font-medium tracking-[-0.04em]">{total === null ? "—" : usd(total)}</Mono>
            {trades.length > 0 && (
              <span className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                <Mono className={`text-[17px] font-medium ${tone(summary.pnl)}`}>
                  {signedCents(summary.pnl)} ({percent(summary.pct)})
                </Mono>
                <span className="text-muted">since you bought · you paid {usd(summary.bought)}</span>
              </span>
            )}
          </div>

          {total !== null && total > 0 && (
            <div className="relative mt-auto flex flex-col gap-2.5">
              <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
                {allocation.map((h, i) => (
                  <span key={h.symbol} title={h.symbol} style={{ flexGrow: h.value ?? 0, background: SHADES[i % SHADES.length] }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {allocation.map((h, i) => (
                  <span key={h.symbol} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: SHADES[i % SHADES.length] }} />
                    <span className="font-bold">{h.cash ? "Cash" : h.symbol}</span>
                    <Mono className="text-muted">{Math.round(((h.value ?? 0) / total) * 100)}%</Mono>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="relative grid grid-cols-3 gap-2">
            <ButtonLink to="/trade" className="h-10 px-3">
              Buy
            </ButtonLink>
            <Button variant="secondary" className="h-10 px-3" disabled={coins.length === 0} onClick={() => setCashOut(coins.flatMap(cashOutItem))}>
              Cash out
            </Button>
            <ButtonLink to="/add-funds" variant="secondary" className="h-10 px-2 whitespace-nowrap">
              Add funds
            </ButtonLink>
          </div>
        </Card>

        <Card className="flex h-[318px] flex-col gap-3 p-5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 font-display text-[16px] leading-none font-bold">Profit and loss</h2>
              <span className="text-[12px] text-muted">Above the line you're up, below it you're down.</span>
            </div>
            <div className="flex gap-1 rounded-full border border-edge p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setPicked(r)}
                  className={`h-7 cursor-pointer rounded-full border-none px-3 text-[11px] font-bold ${range === r ? "bg-text text-ink" : "bg-transparent text-muted hover:text-text"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            {trades.length === 0 ? (
              <p className="m-0 flex h-full items-center justify-center text-sm text-muted">Your profit and loss shows up here after your first trade.</p>
            ) : (
              <>
                <PnlChart points={series} timeVisible={range === "1H" || range === "1D"} />
                {chartLoading && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Spinner />
                  </span>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
        <Card className="flex flex-col overflow-y-auto px-[22px] py-[18px]">
          <h2 className="m-0 mb-2 font-display text-[16px] leading-none font-bold">Holdings</h2>
          <div className={`${HOLDING_GRID} border-b border-edge py-2 text-[10px] font-bold tracking-[0.14em] text-muted`}>
            <span>ASSET</span>
            <span className="text-right">AMOUNT</span>
            <span className="text-right">YOU PAID</span>
            <span className="text-right">PRICE NOW</span>
            <span className="text-right">VALUE</span>
            <span className="text-right">GAIN / LOSS</span>
            <span />
          </div>
          {portfolio.isLoading && (
            <div className="py-6">
              <Spinner />
            </div>
          )}
          {view.map((h) => (
            <div key={`${h.symbol}:${h.chain}`} className={`${HOLDING_GRID} border-b border-line py-3`}>
              <div className="flex min-w-0 items-center gap-3">
                <AssetTile symbol={h.symbol} icon={h.icon} size={34} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-bold">{h.cash ? `Cash (${h.symbol})` : h.name}</span>
                  <span className="text-xs text-muted">{total ? `${Math.round(((h.value ?? 0) / total) * 100)}% of portfolio` : ""}</span>
                </span>
              </div>
              <Mono className="text-right text-[13px] whitespace-nowrap">{tokenAmount(h.total, h.symbol)}</Mono>
              <Mono className="text-right text-[13px] text-muted">{h.pnl?.avgCost != null ? usd(h.pnl.avgCost) : "—"}</Mono>
              <Mono className="text-right text-[13px]">{usd(h.price)}</Mono>
              <Mono className="text-right text-[13px]">{usd(h.value)}</Mono>
              <span className="flex flex-col items-end">
                {h.pnl?.pnl != null ? (
                  <>
                    <Mono className={`text-[13px] ${tone(h.pnl.pnl)}`}>{signedCents(h.pnl.pnl)}</Mono>
                    <Mono className={`text-[11px] ${tone(h.pnl.pnl)}`}>{percent(h.pnl.pct)}</Mono>
                  </>
                ) : (
                  <Mono className="text-[13px] text-muted">—</Mono>
                )}
              </span>
              <span className="flex justify-end">
                {!h.cash && Number(h.available) > 0 && h.assetId && (
                  <button
                    type="button"
                    onClick={() => setCashOut(cashOutItem(h))}
                    className="h-8 cursor-pointer rounded-full border border-edge bg-white/[0.03] px-3 text-[10px] font-bold tracking-[0.12em] text-text uppercase hover:border-faint"
                  >
                    Cash out
                  </button>
                )}
              </span>
            </div>
          ))}
          {ready && !portfolio.isLoading && rows.length === 0 && (
            <p className="text-sm text-muted">
              Nothing here yet. <Link to="/add-funds">Add funds</Link> to get started.
            </p>
          )}
        </Card>

        <Card className="flex flex-col overflow-y-auto px-[22px] py-[18px]">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="m-0 font-display text-[16px] leading-none font-bold">Where your money went</h2>
            <Link to="/activity" className="text-[12px]">
              All activity
            </Link>
          </div>
          {[...trades].reverse().map((f) => {
            const price = priceOf(f.symbol, view.find((h) => h.symbol === f.symbol)?.price ?? null);
            const spent = f.qty * f.price;
            const worth = price === null ? null : f.qty * price;
            const change = worth === null ? null : f.side === "buy" ? worth - spent : spent - worth;
            return (
              <div key={f.id} className="flex items-center gap-3 border-b border-line py-3">
                <AssetTile symbol={f.symbol} icon={assets.data?.find((a) => a.symbol === f.symbol)?.icon} size={30} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-bold">
                    {f.side === "buy" ? "Bought" : "Sold"} {f.symbol} for {usd(spent)}
                  </span>
                  <span className="text-xs text-muted">
                    {tokenAmount(f.qty)} at {usd(f.price)} · {relativeTime(new Date(f.at).toISOString())}
                    {f.explorerUrl && (
                      <>
                        {" · "}
                        <a href={f.explorerUrl} target="_blank" rel="noreferrer">
                          receipt
                        </a>
                      </>
                    )}
                  </span>
                </div>
                {worth !== null && (
                  <span className="flex flex-col items-end gap-0.5">
                    <Mono className="text-[13px]">{usd(worth)}</Mono>
                    <Mono className={`text-[11px] ${tone(change)}`}>{f.side === "buy" ? signedCents(change!) : `${signedCents(change!)} vs. holding`}</Mono>
                  </span>
                )}
              </div>
            );
          })}
          {transactions.isSuccess && trades.length === 0 && <p className="text-sm text-muted">No trades yet.</p>}
        </Card>
      </div>

      {cashOut && <CashOut items={cashOut} onClose={() => setCashOut(null)} />}
    </Page>
  );
}
