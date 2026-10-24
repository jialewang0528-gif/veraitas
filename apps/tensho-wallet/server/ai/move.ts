// Facts about one clicked point on a price chart, so the explanation is grounded in real numbers.

export interface MoveFacts {
  at: string;
  price: number;
  changeBefore: number | null;
  changeAfter: number | null;
  changeFromStart: number | null;
  rangeLow: number;
  rangeHigh: number;
}

const pct = (from: number, to: number) => (from > 0 ? to / from - 1 : null);

// `lookback` is how many samples before the point count as "the move into it".
export function moveFacts(points: { t: string; price: string }[], at: string, lookback = 12): MoveFacts | null {
  const series = points.map((p) => ({ t: p.t, ms: Date.parse(p.t), price: Number(p.price) })).filter((p) => p.price > 0);
  if (series.length < 2) return null;
  const target = Date.parse(at);
  let index = 0;
  for (let i = 1; i < series.length; i++) {
    if (Math.abs(series[i]!.ms - target) < Math.abs(series[index]!.ms - target)) index = i;
  }
  const point = series[index]!;
  const prices = series.map((p) => p.price);
  return {
    at: point.t,
    price: point.price,
    changeBefore: index > 0 ? pct(series[Math.max(0, index - lookback)]!.price, point.price) : null,
    changeAfter: index < series.length - 1 ? pct(point.price, series.at(-1)!.price) : null,
    changeFromStart: pct(series[0]!.price, point.price),
    rangeLow: Math.min(...prices),
    rangeHigh: Math.max(...prices),
  };
}

export function describePercent(ratio: number | null): string {
  if (ratio === null) return "unavailable";
  return `${ratio >= 0 ? "+" : ""}${(ratio * 100).toFixed(2)}%`;
}
