// The VerAItas Agent's built-in crypto knowledge: plain-English basics it always reads, and short profiles of the
// tokens the app offers. Live numbers never live here; they come from True Markets and the web at question time.

export const CRYPTO_PRIMER = `Crypto basics (explain these simply when they come up):
- Crypto trades every hour of every day; there is no closing bell, so prices can move overnight and on weekends.
- Volatility: crypto prices often move 5-10% in a day; small coins and meme coins can move much more.
- Bid and ask: the bid is the highest price a buyer offers, the ask the lowest price a seller accepts. The gap is the spread, a hidden cost of buying and selling right away.
- Slippage: the price you get can differ from the price you saw if the market moves while the order fills.
- Market cap: price times the number of coins; a rough size measure, not a value judgment.
- Volume: how much was traded; low volume means bigger price swings and worse prices for larger orders.
- Stablecoin: a token designed to stay at $1, like USDC. On VerAItas, cash is held as USDC.
- Take-profit and stop-loss: automatic sells once the price rises (take-profit) or falls (stop-loss) by a set amount, to lock in a gain or limit a loss. They are not guaranteed to fill at exactly that price.
- Liquidation: traders who borrowed to bet on a price move are forced to sell when it moves against them, which can push prices further in the same direction quickly.
- ETF flows: money moving into or out of funds that hold a coin for traditional investors; outflows mean more money left than came in.
- Meme coins: tokens driven mostly by community and hype rather than a product; they can rise or fall very fast.
- Network upgrades and "sell the news": prices sometimes fall right after a long-awaited upgrade or announcement, because people bought earlier and sell once it happens.
- Common beginner mistakes: buying after a big spike because of fear of missing out, putting in money you can't afford to lose, panic-selling on a normal dip, and ignoring fees and spreads on small trades.
- On VerAItas, trades run on True Markets: orders are routed for the best available price, the network fee is covered, and every trade needs a press-and-hold to confirm.`;

const PROFILES: Record<string, string> = {
  SOL: "Solana's native coin, used to pay transaction fees and to stake (lock up coins to help secure the network for a reward). Solana is a fast, low-fee blockchain.",
  JUP: "Token of Jupiter, a Solana trading aggregator that finds the best price across Solana exchanges; used for governance votes.",
  JTO: "Token of Jito, a Solana liquid-staking project that lets people stake SOL and still use it; used for governance.",
  PYTH: "Token of Pyth, a network that publishes price data from trading firms to blockchains; used for governance.",
  RAY: "Token of Raydium, an exchange on Solana where people swap tokens and provide liquidity.",
  ORCA: "Token of Orca, a Solana exchange focused on simple swaps.",
  DRIFT: "Token of Drift, a Solana trading platform for leveraged trading.",
  W: "Token of Wormhole, a network that moves tokens and messages between different blockchains.",
  RENDER: "Token of Render, a network that rents out graphics computing power.",
  HNT: "Token of Helium, a network of community-run wireless hotspots.",
  GRASS: "Token of Grass, a network where people share unused internet bandwidth.",
  BONK: "A Solana meme coin with a dog mascot, driven mostly by community hype.",
  WIF: "Dogwifhat, a Solana meme coin based on an internet meme of a dog in a hat.",
  PENGU: "Token tied to the Pudgy Penguins NFT brand; largely community-driven.",
  POPCAT: "A Solana meme coin based on the 'pop cat' internet meme.",
  TRUMP: "A meme coin themed on Donald Trump; very volatile and driven by news and hype.",
  CBBTC: "Coinbase Wrapped Bitcoin on Base: a token backed one-to-one by Bitcoin held by Coinbase, so it tracks Bitcoin's price.",
  AERO: "Token of Aerodrome, the main exchange on Coinbase's Base network.",
  MORPHO: "Token of Morpho, a lending protocol where people lend and borrow crypto.",
  ZORA: "Token of Zora, a creator and social network on Base.",
};

export function coinProfile(symbol: string): string | undefined {
  return PROFILES[symbol.toUpperCase()];
}

export function offeredProfiles(symbols: string[]): string {
  return symbols
    .map((s) => (PROFILES[s.toUpperCase()] ? `- ${s.toUpperCase()}: ${PROFILES[s.toUpperCase()]}` : null))
    .filter(Boolean)
    .join("\n");
}
