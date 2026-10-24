import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { useMarket } from "../api.ts";
import { compactUsd, usd } from "../format.ts";
import type { AssetRow, ChartRange, MarketData } from "../types.ts";
import { Explainable } from "./Explain.tsx";
import { AssetTile, Card, Label, Mono, PriceChange, Spinner } from "./ui.tsx";

const RANGES: ChartRange[] = ["1H", "1D", "1W", "1M"];
const RANGE_LABEL: Record<ChartRange, string> = {
  "1H": "past hour",
  "1D": "past day",
  "1W": "past week",
  "1M": "past month",
};

const UP = "#3ddc97";
const DOWN = "#ff6b6b";

function PriceChart({
  points,
  range,
}: {
  points: MarketData["points"];
  range: ChartRange;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    chart.current = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#87847e",
        fontFamily: "DM Sans, system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#1c1c1b" } },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: { borderVisible: false, rightOffset: 2 },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "#6f6d68",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2a2a28",
        },
        horzLine: {
          color: "#6f6d68",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2a2a28",
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
      crosshairMarkerBackgroundColor: "#0f0f0e",
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
      color: "#6f6d68",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });
    api.timeScale().fitContent();
    return () => {
      if (chart.current === api) api.removeSeries(series);
    };
  }, [points, range]);

  return <div ref={container} className="h-[340px] w-full" />;
}

function StatItem({
  label,
  value,
  symbol,
}: {
  label: string;
  value: string;
  symbol: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Explainable
        label={label}
        value={value}
        context={`${symbol} market stats on the Trade page`}
      >
        <Label>{label}</Label>
      </Explainable>
      <Mono className="text-[15px] font-medium">{value}</Mono>
    </div>
  );
}

export function MarketPanel({ token }: { token: AssetRow }) {
  const [range, setRange] = useState<ChartRange>("1D");
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
          <StatItem
            symbol={token.symbol}
            label="Market cap"
            value={compactUsd(stats?.market_cap)}
          />
          <StatItem
            symbol={token.symbol}
            label="24h volume"
            value={compactUsd(stats?.volume_24h)}
          />
          <StatItem
            symbol={token.symbol}
            label="24h low"
            value={usd(stats?.low_24h)}
          />
          <StatItem
            symbol={token.symbol}
            label="24h high"
            value={usd(stats?.high_24h)}
          />
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
          <PriceChart points={points} range={range} />
        )}
      </div>

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
                  ? "border-text bg-text text-ink"
                  : "border-edge bg-transparent text-muted hover:border-faint hover:text-text"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-2 text-[11px] text-faint">
          <span className="live-dot" />
          Live from True Markets
        </span>
      </div>
    </Card>
  );
}
