import { Hono } from "hono";
import type { AppDeps } from "../app.ts";
import { ApiError } from "../http.ts";
import { requireCustomer, type AppEnv } from "../session.ts";

// Each chart range maps to a lookback window and a sample gap the market data API accepts.
export const CHART_RANGES = {
  "1H": { window: "1h", resolution: "1m" },
  "1D": { window: "1d", resolution: "5m" },
  "1W": { window: "7d", resolution: "1h" },
  "1M": { window: "1M", resolution: "4h" },
} as const;

type ChartRange = keyof typeof CHART_RANGES;

function isChartRange(value: string): value is ChartRange {
  return value in CHART_RANGES;
}

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

export function marketRoutes({ gateway, assets }: AppDeps) {
  return new Hono<AppEnv>().get("/market/:asset_id", requireCustomer, async (c) => {
    const asset = assets.byId(c.req.param("asset_id"));
    if (!asset || assets.isCash(asset)) throw new ApiError(400, "invalid_argument", "asset is not offered for trading");
    const range = c.req.query("range") ?? "1D";
    if (!isChartRange(range)) throw new ApiError(400, "invalid_argument", `range must be one of ${Object.keys(CHART_RANGES).join(", ")}`);

    const { window, resolution } = CHART_RANGES[range];
    // The chart is required; the stats around it are best effort, so one slow feed never blanks the page.
    const [history, cap, volume, day] = await Promise.allSettled([
      gateway.priceHistory(asset.symbol, window, resolution),
      gateway.marketCap(asset.symbol),
      gateway.volumeHistory(asset.symbol, "1d", "1d"),
      gateway.priceRange(asset.symbol, "1d"),
    ]);
    if (history.status === "rejected") throw history.reason;

    const range24h = settled(day);
    return c.json({
      symbol: asset.symbol,
      range,
      points: history.value.points,
      stats: {
        market_cap: settled(cap)?.market_cap ?? null,
        volume_24h: settled(volume)?.points.at(-1)?.volume ?? null,
        low_24h: range24h?.min_price ?? null,
        high_24h: range24h?.max_price ?? null,
      },
    });
  });
}
