import { existsSync } from "node:fs";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { AssetCatalog } from "./assets.ts";
import { ApiError, errorResponse } from "./http.ts";
import type { PriceBook } from "./prices.ts";
import { agentRoutes } from "./routes/agent.ts";
import { authRoutes } from "./routes/auth.ts";
import { exitRoutes } from "./routes/exits.ts";
import { marketRoutes } from "./routes/market.ts";
import { orderDesk, orderRoutes } from "./routes/orders.ts";
import { quoteRoutes } from "./routes/quotes.ts";
import { transferRoutes } from "./routes/transfers.ts";
import { walletRoutes } from "./routes/wallet.ts";
import type * as gateway from "./tm/gateway.ts";

export interface AppDeps {
  gateway: typeof gateway;
  assets: AssetCatalog;
  prices: PriceBook;
}

const DIST = "./dist";

export function createApp(deps: AppDeps) {
  // One desk, so an order the agent prepares is signable through the same execute route as the ticket's.
  const desk = orderDesk(deps);
  const app = new Hono()
    .route("/api", authRoutes(deps))
    .route("/api", walletRoutes(deps))
    .route("/api", marketRoutes(deps))
    .route("/api", quoteRoutes(deps))
    .route("/api", orderRoutes(deps, desk))
    .route("/api", agentRoutes(deps, desk))
    .route("/api", transferRoutes(deps))
    .route("/api", exitRoutes(deps))
    .all("/api/*", () => {
      throw new ApiError(404, "not_found", "not found");
    });

  app.onError(errorResponse);

  if (existsSync(DIST)) {
    app.use("*", serveStatic({ root: DIST }));
    app.get("*", serveStatic({ path: `${DIST}/index.html` }));
  }

  return app;
}
