import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { useBeginnerMode } from "../beginner.tsx";
import { cumulative, summarize, type Level } from "../book.ts";
import { usd } from "../format.ts";
import { richText } from "../rich.tsx";
import { Explainable } from "./Explain.tsx";
import { Card, Label, Mono } from "./ui.tsx";

const STREAM = "wss://api.truemarkets.co/v1/defi/market";
const ROWS = 7;

interface Book {
  bids: Level[];
  asks: Level[];
  at: string;
}

// The public True Markets market-data stream carries full depth for Hyperliquid books; no credentials needed.
function useOrderBook(symbol: string) {
  const [book, setBook] = useState<Book | null>(null);
  const [state, setState] = useState<"connecting" | "live" | "none">(
    "connecting",
  );

  useEffect(() => {
    setBook(null);
    setState("connecting");
    const topic = `orderbook.hyperliquid-perp.${symbol.toUpperCase()}-USD`;
    const ws = new WebSocket(STREAM);
    const noBook = setTimeout(
      () => setState((s) => (s === "connecting" ? "none" : s)),
      6000,
    );
    ws.onopen = () =>
      ws.send(JSON.stringify({ type: "subscribe", topics: [topic] }));
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as {
        type?: string;
        data?: { bids: Level[]; asks: Level[]; event_timestamp?: string };
      };
      if (message.type !== "orderbook" || !message.data) return;
      setBook({
        bids: message.data.bids,
        asks: message.data.asks,
        at: message.data.event_timestamp ?? new Date().toISOString(),
      });
      setState("live");
    };
    return () => {
      clearTimeout(noBook);
      ws.close();
    };
  }, [symbol]);

  return { book, state };
}

function size(value: string): string {
  const n = Number(value);
  return n >= 1000
    ? `${(n / 1000).toFixed(1)}K`
    : n >= 1
      ? n.toFixed(2)
      : n.toPrecision(3);
}

function Side({
  levels,
  tone,
  max,
  symbol,
}: {
  levels: Level[];
  tone: "up" | "down";
  max: number;
  symbol: string;
}) {
  const totals = cumulative(levels);
  return (
    <div className="flex flex-col">
      {levels.map((level, i) => (
        <div
          key={`${level.px}-${i}`}
          className="relative grid grid-cols-3 px-2 py-[3px] text-[12px]"
        >
          <span
            aria-hidden
            className={`absolute inset-y-0 ${tone === "up" ? "left-0 bg-up/10" : "right-0 bg-down/10"}`}
            style={{ width: `${Math.min(100, (totals[i]! / max) * 100)}%` }}
          />
          <span className="relative">
            <Explainable
              label={
                tone === "up"
                  ? "Buy orders at this price"
                  : "Sell orders at this price"
              }
              value={`${size(level.sz)} ${symbol} waiting at ${usd(level.px)}; ${size(String(totals[i]))} ${symbol} in total from the best price to here`}
              context={`One ${tone === "up" ? "bid" : "ask"} level of the live ${symbol} order book in a beginner crypto app`}
            >
              <Mono className={tone === "up" ? "text-up" : "text-down"}>
                {usd(level.px)}
              </Mono>
            </Explainable>
          </span>
          <Mono className="relative text-right text-muted">
            {size(level.sz)}
          </Mono>
          <Mono className="relative text-right text-faint">
            {size(String(totals[i]))}
          </Mono>
        </div>
      ))}
    </div>
  );
}

export function OrderBook({ symbol }: { symbol: string }) {
  const { beginner } = useBeginnerMode();
  const { book, state } = useOrderBook(symbol);
  const bids = book?.bids.slice(0, ROWS) ?? [];
  const asks = book?.asks.slice(0, ROWS) ?? [];
  const s = book ? summarize(book.bids, book.asks) : null;
  const max = Math.max(
    cumulative(bids).at(-1) ?? 0,
    cumulative(asks).at(-1) ?? 0,
    1e-9,
  );

  const explain = useMutation({
    mutationFn: () =>
      api<{ text: string }>("/api/agent/explain-book", {
        method: "POST",
        body: {
          symbol,
          best_bid: s!.bestBid,
          best_ask: s!.bestAsk,
          spread_bps: s!.spreadBps,
          bid_depth_usd: s!.bidDepthUsd,
          ask_depth_usd: s!.askDepthUsd,
        },
      }),
  });
  useEffect(() => explain.reset(), [symbol, beginner]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = `Live order book for ${symbol} on the Trade page of a beginner crypto app`;
  return (
    <Card className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="m-0 font-display text-[16px] leading-none font-bold whitespace-nowrap">
          Order book
        </h2>
        <span className="flex items-center gap-2 text-[11px] text-faint">
          {state === "live" && <span className="live-dot" />}
          {state === "live"
            ? "Live · Hyperliquid"
            : state === "connecting"
              ? "Connecting"
              : `No public book for ${symbol}`}
        </span>
      </div>

      {s && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              [
                "Bid",
                s.bestBid,
                "text-up",
                "border-up/30 bg-up/10",
                "Highest price someone is offering to pay right now.",
              ],
              [
                "Mid",
                s.mid,
                "text-text",
                "border-edge bg-white/[0.03]",
                "Halfway between the best bid and best ask.",
              ],
              [
                "Ask",
                s.bestAsk,
                "text-down",
                "border-down/30 bg-down/10",
                "Lowest price someone is willing to sell at right now.",
              ],
            ] as const
          ).map(([label, value, tone, box, hint]) => (
            <div
              key={label}
              className={`flex flex-col items-center gap-0.5 rounded-[10px] border py-2 ${box}`}
            >
              <Explainable
                label={label}
                value={usd(value)}
                context={`${ctx}. ${hint}`}
              >
                <Label>{label}</Label>
              </Explainable>
              <Mono className={`text-[15px] font-medium ${tone}`}>
                {usd(value)}
              </Mono>
            </div>
          ))}
        </div>
      )}

      {state === "none" ? (
        <p className="m-0 py-6 text-center text-sm text-muted">
          This token has no public order book on the stream.
        </p>
      ) : !book ? (
        <p className="m-0 flex items-center justify-center gap-2 py-6 text-sm text-muted">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          Loading the book
        </p>
      ) : (
        <div className="flex flex-col">
          <div className="grid grid-cols-3 px-2 pb-1.5 text-[10px] font-bold tracking-[0.12em] text-faint uppercase">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>
          <Side
            levels={[...asks].reverse()}
            tone="down"
            max={max}
            symbol={symbol}
          />
          <div className="my-1 flex items-center justify-between border-y border-line px-2 py-1.5 text-[12px]">
            <Explainable
              label="Spread"
              value={
                s ? `${usd(s.spread)} (${s.spreadBps.toFixed(2)} bps)` : ""
              }
              context={`${ctx}. The gap between the best ask and the best bid.`}
            >
              <span className="text-[10px] font-bold tracking-[0.12em] text-muted uppercase">
                Spread
              </span>
            </Explainable>
            <Mono className="text-text">
              {s ? `${usd(s.spread)} · ${s.spreadBps.toFixed(2)} bps` : "—"}
            </Mono>
          </div>
          <Side levels={bids} tone="up" max={max} symbol={symbol} />
          {s && (
            <div className="mt-3 flex flex-col gap-1">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-down/40">
                <span
                  className="bg-up"
                  style={{ width: `${s.bidShare * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-faint">
                <span>Buyers {Math.round(s.bidShare * 100)}%</span>
                <span>Sellers {Math.round((1 - s.bidShare) * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {beginner && s && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {explain.data ? (
            <p className="m-0 text-[13px] leading-relaxed">
              {richText(explain.data.text)}
            </p>
          ) : explain.isError ? (
            <p className="m-0 text-[13px] text-muted">
              Explanation unavailable.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => explain.mutate()}
            disabled={explain.isPending}
            className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full border border-edge bg-white/[0.03] text-[11px] font-bold tracking-[0.12em] text-text uppercase hover:border-faint disabled:cursor-wait disabled:opacity-60"
          >
            {explain.isPending ? (
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            ) : (
              <Sparkles aria-hidden className="size-3.5" />
            )}
            {explain.data ? "Explain again" : "Explain this order book"}
          </button>
        </div>
      )}
    </Card>
  );
}
