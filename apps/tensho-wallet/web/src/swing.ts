// Swing Check math: turn price samples into one closing price per day, then day-over-day changes.

export interface DailyMove {
  day: string;
  change: number;
}

export function dailyMoves(points: { t: string; price: string }[], days = 30): DailyMove[] {
  const closes = new Map<string, number>();
  for (const p of [...points].sort((a, b) => a.t.localeCompare(b.t))) {
    const price = Number(p.price);
    // The last sample of each UTC day wins, so the map ends up holding daily closes.
    if (Number.isFinite(price) && price > 0) closes.set(p.t.slice(0, 10), price);
  }
  const ordered = [...closes.entries()];
  const moves: DailyMove[] = [];
  for (let i = 1; i < ordered.length; i++) {
    moves.push({ day: ordered[i]![0], change: ordered[i]![1] / ordered[i - 1]![1] - 1 });
  }
  return moves.slice(-days);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface SwingSummary {
  moves: DailyMove[];
  typicalUsd: number;
  worstChange: number;
  worstDay: string;
  worstValueUsd: number;
}

export function swingSummary(points: { t: string; price: string }[], amount: number): SwingSummary | null {
  const moves = dailyMoves(points);
  if (moves.length < 2 || !(amount > 0)) return null;
  const worst = moves.reduce((low, m) => (m.change < low.change ? m : low));
  return {
    moves,
    typicalUsd: median(moves.map((m) => Math.abs(m.change))) * amount,
    worstChange: worst.change,
    worstDay: worst.day,
    worstValueUsd: amount * (1 + worst.change),
  };
}
