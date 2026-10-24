import { Link } from "react-router";
import { useAssets } from "../api.ts";
import { usd, toRatio } from "../format.ts";
import { PriceChange } from "./ui.tsx";

// The live price strip a trading terminal opens with. Two copies of the list scroll as one seamless loop.
export function TickerTape() {
  const assets = useAssets();
  const tokens = (assets.data ?? []).filter((a) => !a.cash && a.price !== null);
  if (tokens.length === 0) return <div className="h-9 border-b border-line bg-night" />;

  const items = tokens.map((t) => (
    <Link
      key={t.asset_id}
      to={`/trade?asset=${encodeURIComponent(t.asset_id)}`}
      className="flex shrink-0 items-center gap-2 px-4 text-[12px] text-text no-underline hover:bg-line hover:text-text"
    >
      <span className="font-bold tracking-[0.04em]">{t.symbol}</span>
      <span className="font-mono tabular-nums text-muted">{usd(t.price)}</span>
      <PriceChange ratio={toRatio(t.change_24h)} className="text-[11px]" />
    </Link>
  ));

  return (
    <div className="ticker group relative h-9 overflow-hidden border-b border-line bg-night" aria-label="Live prices">
      <div className="ticker-track flex h-full w-max items-center group-hover:[animation-play-state:paused]">
        <div className="flex h-full items-center">{items}</div>
        <div className="flex h-full items-center" aria-hidden>
          {items}
        </div>
      </div>
    </div>
  );
}
