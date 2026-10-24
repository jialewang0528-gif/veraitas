// Order-book math for the depth view and for the facts the agent explains.

export interface Level {
  px: string;
  sz: string;
  n?: number;
}

export interface BookSummary {
  bestBid: number;
  bestAsk: number;
  mid: number;
  spread: number;
  spreadBps: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  // Share of the shown dollar depth that sits on the buy side, 0..1.
  bidShare: number;
}

const usdOf = (levels: Level[]) => levels.reduce((sum, l) => sum + Number(l.px) * Number(l.sz), 0);

export function summarize(bids: Level[], asks: Level[], depth = 10): BookSummary | null {
  const bestBid = Number(bids[0]?.px);
  const bestAsk = Number(asks[0]?.px);
  if (!(bestBid > 0 && bestAsk > 0)) return null;
  const mid = (bestBid + bestAsk) / 2;
  const bidDepthUsd = usdOf(bids.slice(0, depth));
  const askDepthUsd = usdOf(asks.slice(0, depth));
  const total = bidDepthUsd + askDepthUsd;
  return {
    bestBid,
    bestAsk,
    mid,
    spread: bestAsk - bestBid,
    spreadBps: ((bestAsk - bestBid) / mid) * 10_000,
    bidDepthUsd,
    askDepthUsd,
    bidShare: total > 0 ? bidDepthUsd / total : 0.5,
  };
}

// Running totals from the best price outward, for the depth bars.
export function cumulative(levels: Level[]): number[] {
  let sum = 0;
  return levels.map((l) => (sum += Number(l.sz)));
}
