// Numbers for the Before You Buy card. Every input comes from live quotes or market data.

export interface GuideInput {
  spend: number;
  qtyOut: number | null;
  marketPrice: number | null;
  // A real sell quote, which True Markets only gives once the wallet holds the token.
  sellBack: number | null;
  feeUsd: number | null;
  low24h: number | null;
  high24h: number | null;
  hourPoints: { price: string }[];
}

export interface GuideNumbers {
  hiddenCost: number | null;
  sellBack: number | null;
  sellBackEstimated: boolean;
  roundTripCost: number | null;
  range24h: [number, number] | null;
  pastHour: number | null;
}

const known = (n: number | null): n is number =>
  n !== null && Number.isFinite(n);

export function guideNumbers({
  spend,
  qtyOut,
  marketPrice,
  sellBack,
  feeUsd,
  low24h,
  high24h,
  hourPoints,
}: GuideInput): GuideNumbers {
  const qty = known(qtyOut) && qtyOut > 0 ? qtyOut : null;
  const first = Number(hourPoints[0]?.price);
  const last = Number(hourPoints.at(-1)?.price);
  const worth =
    qty !== null && known(marketPrice) && marketPrice > 0
      ? qty * marketPrice
      : null;
  // What you pay minus what the coins are worth at the chart price.
  const hiddenCost = worth === null ? null : spend - worth;
  // Without a sell quote, mirror the buy: the coins' chart value minus the same spread and fee.
  const mirrored =
    worth !== null && hiddenCost !== null && known(feeUsd)
      ? worth - Math.max(0, hiddenCost) - feeUsd
      : null;
  const exit = known(sellBack) ? sellBack : mirrored;
  return {
    hiddenCost,
    sellBack: exit,
    sellBackEstimated: !known(sellBack) && mirrored !== null,
    roundTripCost: exit === null ? null : spend - exit,
    range24h:
      qty !== null && known(low24h) && known(high24h)
        ? [qty * low24h, qty * high24h]
        : null,
    pastHour: first > 0 && Number.isFinite(last) ? last / first - 1 : null,
  };
}

const ABOUT: Record<string, string> = {
  SOL: "native coin of the Solana network.",
  JUP: "token of Jupiter, a Solana trading aggregator.",
  JTO: "token of Jito, a Solana staking protocol.",
  PYTH: "token of Pyth, a price data network.",
  RAY: "token of Raydium, a Solana exchange.",
  ORCA: "token of Orca, a Solana exchange.",
  DRIFT: "token of Drift, a Solana trading protocol.",
  W: "token of Wormhole, a cross-chain messaging network.",
  RENDER: "token of Render, a GPU computing network.",
  HNT: "token of Helium, a wireless network.",
  BONK: "Solana meme coin.",
  WIF: "Solana meme coin.",
  PENGU: "token of the Pudgy Penguins brand.",
  POPCAT: "Solana meme coin.",
  TRUMP: "meme coin.",
  CBBTC: "Coinbase-wrapped Bitcoin on Base.",
  AERO: "token of Aerodrome, a Base exchange.",
  MORPHO: "token of Morpho, a lending protocol.",
  ZORA: "token of Zora, a creator network on Base.",
};

export function aboutToken(symbol: string): string | null {
  const line = ABOUT[symbol.toUpperCase()];
  return line ? `${symbol.toUpperCase()}: ${line}` : null;
}
