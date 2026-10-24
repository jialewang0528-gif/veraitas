import { BaselineSeries, ColorType, CrosshairMode, LineStyle, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { PricePoint } from "../pnl.ts";

const UP = "#3fcf85";
const DOWN = "#f04a63";

// Profit above the zero line in green, loss below it in red; zero is what was paid.
export function PnlChart({ points, timeVisible }: { points: PricePoint[]; timeVisible: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Baseline"> | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const api = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#707070",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#161616" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.15 } },
      timeScale: { borderVisible: false, rightOffset: 1, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "#4a4a4a", style: LineStyle.Dashed, labelBackgroundColor: "#262626" },
        horzLine: { color: "#4a4a4a", style: LineStyle.Dashed, labelBackgroundColor: "#262626" },
      },
      handleScale: false,
      handleScroll: false,
    });
    series.current = api.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: UP,
      topFillColor1: `${UP}40`,
      topFillColor2: `${UP}05`,
      bottomLineColor: DOWN,
      bottomFillColor1: `${DOWN}05`,
      bottomFillColor2: `${DOWN}40`,
      lineWidth: 2,
      priceLineStyle: LineStyle.Dotted,
      crosshairMarkerBackgroundColor: "#0a0a0a",
      priceFormat: { type: "custom", formatter: (v: number) => `${v < -0.004 ? "-" : v > 0.004 ? "+" : ""}$${Math.abs(v).toFixed(2)}`, minMove: 0.01 },
    });
    series.current.createPriceLine({ price: 0, color: "#4a4a4a", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    chart.current = api;
    return () => {
      api.remove();
      chart.current = null;
      series.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.applyOptions({ timeScale: { timeVisible, secondsVisible: false } });
  }, [timeVisible]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const seen = new Set<number>();
    const data = [];
    for (const p of points) {
      const time = Math.floor(p.t / 1000);
      if (seen.has(time)) data.pop();
      seen.add(time);
      data.push({ time: time as UTCTimestamp, value: p.price });
    }
    s.setData(data);
    s.applyOptions({ priceLineColor: (points.at(-1)?.price ?? 0) >= 0 ? UP : DOWN });
    chart.current?.timeScale().fitContent();
  }, [points]);

  return <div ref={container} className="h-full w-full" />;
}
