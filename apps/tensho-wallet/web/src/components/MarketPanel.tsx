import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, useMarket } from "../api.ts";
import { useBeginnerMode } from "../beginner.tsx";
import { richText } from "../rich.tsx";
import { compactUsd, usd } from "../format.ts";
import type { AssetRow, ChartRange, MarketData } from "../types.ts";
import { AssetTile, Card, Label, Mono, PriceChange, Spinner } from "./ui.tsx";

const RANGES: ChartRange[] = ["1H", "1D", "1W", "1M"];
const RANGE_LABEL: Record<ChartRange, string> = {
  "1H": "past hour",
  "1D": "past day",
  "1W": "past week",
  "1M": "past month",
};

const UP = "#3fcf85";
const DOWN = "#f04a63";

function PriceChart({
  points,
  range,
  picked,
  onPick,
}: {
  points: MarketData["points"];
  range: ChartRange;
  picked?: string;
  onPick?: (at: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    chart.current = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6c7182",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#11141d" } },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: { borderVisible: false, rightOffset: 2 },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "#4a4c5c",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1f2433",
        },
        horzLine: {
          color: "#4a4c5c",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1f2433",
        },
      },
      handleScale: false,
      handleScroll: false,
    });
    return () => {
      chart.current?.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const api = chart.current;
    if (!api || points.length === 0) return;
    const first = Number(points[0]!.price);
    const last = Number(points.at(-1)!.price);
    const color = last >= first ? UP : DOWN;

    api.applyOptions({
      timeScale: {
        timeVisible: range === "1H" || range === "1D",
        secondsVisible: false,
      },
    });
    const series = api.addSeries(AreaSeries, {
      lineColor: color,
      lineWidth: 2,
      topColor: `${color}38`,
      bottomColor: `${color}00`,
      priceLineColor: color,
      priceLineStyle: LineStyle.Dotted,
      crosshairMarkerBorderColor: color,
      crosshairMarkerBackgroundColor: "#05060a",
      priceFormat: {
        type: "custom",
        formatter: (price: number) => usd(price),
        minMove: 1e-8,
      },
    });
    series.setData(
      points.map((p) => ({
        time: (Date.parse(p.t) / 1000) as UTCTimestamp,
        value: Number(p.price),
      })),
    );
    // Where the range opened, so "up or down since then" reads at a glance.
    series.createPriceLine({
      price: first,
      color: "#4a4c5c",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });
    if (picked) {
      createSeriesMarkers(series, [
        {
          time: (Date.parse(picked) / 1000) as UTCTimestamp,
          position: "inBar",
          color: "#ebe8e1",
          shape: "circle",
          size: 1.4,
        },
      ]);
    }
    api.timeScale().fitContent();
    const onClick = (param: MouseEventParams) => {
      if (typeof param.time === "number")
        pick.current?.(new Date(param.time * 1000).toISOString());
    };
    api.subscribeClick(onClick);
    return () => {
      api.unsubscribeClick(onClick);
      if (chart.current === api) api.removeSeries(series);
    };
  }, [points, range, picked]);

  return (
    <div
      ref={container}
      className={`h-[340px] w-full ${onPick ? "cursor-crosshair" : ""}`}
    />
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Mono className="text-[15px] font-medium">{value}</Mono>
    </div>
  );
}

// Beginner Mode: the agent explains the move at the point the user clicked.
function MoveExplainer({
  token,
  range,
  at,
  onClose,
}: {
  token: AssetRow;
  range: ChartRange;
  at: string;
  onClose: () => void;
}) {
  const move = useQuery({
    queryKey: ["explain-move", token.asset_id, range, at],
    queryFn: () =>
      api<{ text: string; at: string; price: number }>(
        "/api/agent/explain-move",
        {
          method: "POST",
          body: { asset_id: token.asset_id, range, at },
        },
      ),
    staleTime: 60_000,
    retry: false,
  });
  const when = new Date(move.data?.at ?? at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-[12px] border border-edge bg-ink p-4"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
          <Sparkles aria-hidden className="size-3.5" />
          {token.symbol} at {when}
          {move.data && (
            <span className="font-mono tracking-normal normal-case">
              · {usd(move.data.price)}
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex cursor-pointer border-none bg-transparent p-0 text-muted hover:text-text"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <p className="m-0 text-[14px] leading-relaxed">
        {move.isFetching ? (
          <span className="inline-flex items-center gap-2 text-muted">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            Checking the news around this point
          </span>
        ) : move.data ? (
          richText(move.data.text)
        ) : (
          "Explanation unavailable."
        )}
      </p>
    </div>
  );
}

export function MarketPanel({ token }: { token: AssetRow }) {
  const [range, setRange] = useState<ChartRange>("1D");
  const { beginner } = useBeginnerMode();
  const [picked, setPicked] = useState<string>();
  useEffect(() => setPicked(undefined), [range, token.asset_id, beginner]);
  const market = useMarket(token.asset_id, range);
  const points = market.data?.symbol === token.symbol ? market.data.points : [];
  const first = points.length ? Number(points[0]!.price) : null;
  const last = points.length
    ? Number(points.at(-1)!.price)
    : token.price === null
      ? null
      : Number(token.price);
  const change = first && last !== null ? (last - first) / first : null;
  const stats = market.data?.stats;

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-3.5">
          <AssetTile symbol={token.symbol} icon={token.icon} size={44} />
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2.5">
              <h2 className="m-0 font-display text-[22px] leading-none font-bold">
                {token.name}
              </h2>
              <span className="text-sm text-muted">{token.symbol}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <Mono className="text-[30px] leading-none font-medium tracking-[-0.03em]">
                {usd(last)}
              </Mono>
              <PriceChange ratio={change} className="text-sm" />
              <span className="text-xs text-faint">{RANGE_LABEL[range]}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-7">
          <StatItem label="Market cap" value={compactUsd(stats?.market_cap)} />
          <StatItem label="24h volume" value={compactUsd(stats?.volume_24h)} />
          <StatItem label="24h low" value={usd(stats?.low_24h)} />
          <StatItem label="24h high" value={usd(stats?.high_24h)} />
        </div>
      </div>

      <div className="relative">
        {market.isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Spinner label="Loading chart" />
          </div>
        )}
        {market.error && !points.length ? (
          <p className="m-0 flex h-[340px] items-center justify-center text-sm text-muted">
            Chart unavailable right now.
          </p>
        ) : (
          <PriceChart
            points={points}
            range={range}
            picked={beginner ? picked : undefined}
            onPick={beginner ? setPicked : undefined}
          />
        )}
      </div>

      {beginner && picked && (
        <MoveExplainer
          token={token}
          range={range}
          at={picked}
          onClose={() => setPicked(undefined)}
        />
      )}

      <div className="flex items-center justify-between">
        <div role="group" aria-label="Chart range" className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`h-8 cursor-pointer rounded-full border px-3.5 text-[11px] font-bold tracking-[0.1em] transition-colors duration-200 ${
                range === r
                  ? "border-accent/60 bg-accent/15 text-text"
                  : "border-edge bg-transparent text-muted hover:border-faint hover:text-text"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-2 text-[11px] text-faint">
          {beginner ? (
            <>
              <Sparkles aria-hidden className="size-3.5" />
              Click any point on the chart to explain that move
            </>
          ) : (
            <>
              <span className="live-dot" />
              Live from True Markets
            </>
          )}
        </span>
      </div>
    </Card>
  );
}
