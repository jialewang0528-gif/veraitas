import { Hono } from "hono";
import { z } from "zod";
import { BOOK_PROMPT, EXPLAIN_PROMPT, MOVE_PROMPT, runAgent } from "../ai/agent.ts";
import { describePercent, moveFacts } from "../ai/move.ts";
import { AGENT_MODEL, chat } from "../ai/openrouter.ts";
import type { AppDeps } from "../app.ts";
import { ApiError, parseJson } from "../http.ts";
import { requireCustomer, type AppEnv } from "../session.ts";
import { CHART_RANGES } from "./market.ts";
import type { OrderDesk } from "./orders.ts";

const explainBody = z.object({
  label: z.string().min(1).max(80),
  value: z.string().max(200),
  context: z.string().max(400).default(""),
});

const moveBody = z.object({
  asset_id: z.string().min(1),
  range: z.enum(["1H", "1D", "1W", "1M"]),
  at: z.string().datetime({ offset: true }),
});

const bookBody = z.object({
  symbol: z.string().min(1).max(20),
  best_bid: z.number().positive(),
  best_ask: z.number().positive(),
  spread_bps: z.number().nonnegative(),
  bid_depth_usd: z.number().nonnegative(),
  ask_depth_usd: z.number().nonnegative(),
});

const EXPLAIN_TTL_MS = 60_000;

export function agentRoutes(deps: AppDeps, desk: OrderDesk) {
  const explained = new Map<string, { text: string; at: number }>();

  function cached(key: string): string | undefined {
    const hit = explained.get(key);
    return hit && Date.now() - hit.at < EXPLAIN_TTL_MS ? hit.text : undefined;
  }

  return new Hono<AppEnv>()
    .post("/agent/chat", requireCustomer, async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        messages?: unknown;
      };
      return c.json(await runAgent(deps, desk, c.var.customer, body.messages));
    })
    .post("/agent/explain", requireCustomer, async (c) => {
      const { label, value, context } = await parseJson(c, explainBody);
      const key = JSON.stringify([label, value, context]);
      const hit = cached(key);
      if (hit) return c.json({ text: hit });

      const res = await chat(
        {
          model: AGENT_MODEL,
          max_tokens: 120,
          messages: [
            { role: "system", content: EXPLAIN_PROMPT },
            {
              role: "user",
              content: `Label: ${label}\nValue: ${value}\nContext: ${context}`,
            },
          ],
        },
        20_000,
      );
      const text = res.choices[0]?.message.content?.trim() || "Explanation unavailable.";
      explained.set(key, { text, at: Date.now() });
      return c.json({ text });
    })
    // A beginner clicks a point on the chart; explain that move from the real prices around it plus a quick news search.
    .post("/agent/explain-move", requireCustomer, async (c) => {
      const { asset_id, range, at } = await parseJson(c, moveBody);
      const asset = deps.assets.byId(asset_id);
      if (!asset || deps.assets.isCash(asset)) throw new ApiError(400, "invalid_argument", "asset is not offered for trading");

      const { window, resolution } = CHART_RANGES[range];
      const { points } = await deps.gateway.priceHistory(asset.symbol, window, resolution);
      const facts = moveFacts(points, at);
      if (!facts) throw new ApiError(422, "failed_precondition", "not enough price history");

      const key = JSON.stringify([asset.symbol, range, facts.at]);
      const hit = cached(key);
      if (hit) return c.json({ text: hit, at: facts.at, price: facts.price });

      const when = new Date(facts.at).toUTCString();
      const res = await chat(
        {
          model: AGENT_MODEL,
          plugins: [{ id: "web", engine: "exa", max_results: 3 }],
          max_tokens: 260,
          messages: [
            { role: "system", content: MOVE_PROMPT },
            {
              role: "user",
              content: [
                `Coin: ${asset.name} (${asset.symbol}). Chart range: ${range}.`,
                `Clicked point: ${when}, price $${facts.price}.`,
                `Move into this point: ${describePercent(facts.changeBefore)}. Since then to now: ${describePercent(facts.changeAfter)}.`,
                `From the start of the chart to this point: ${describePercent(facts.changeFromStart)}. Chart low $${facts.rangeLow}, high $${facts.rangeHigh}.`,
                `Search for news about ${asset.name} ${asset.symbol} around ${when.slice(5, 16)}.`,
              ].join("\n"),
            },
          ],
        },
        20_000,
      );
      const text = res.choices[0]?.message.content?.trim() || "Explanation unavailable.";
      explained.set(key, { text, at: Date.now() });
      return c.json({ text, at: facts.at, price: facts.price });
    })
    // A beginner asks what the live order book is saying; the numbers come from the book the page is showing.
    .post("/agent/explain-book", requireCustomer, async (c) => {
      const b = await parseJson(c, bookBody);
      const res = await chat(
        {
          model: AGENT_MODEL,
          max_tokens: 220,
          messages: [
            { role: "system", content: BOOK_PROMPT },
            {
              role: "user",
              content: [
                `Coin: ${b.symbol}. Best bid (highest price a buyer offers): $${b.best_bid}. Best ask (lowest price a seller accepts): $${b.best_ask}.`,
                `Spread: $${(b.best_ask - b.best_bid).toFixed(6)} (${b.spread_bps.toFixed(2)} basis points).`,
                `Dollars waiting to buy in the top 10 levels: $${Math.round(b.bid_depth_usd)}. Dollars waiting to sell: $${Math.round(b.ask_depth_usd)}.`,
              ].join("\n"),
            },
          ],
        },
        15_000,
      );
      return c.json({ text: res.choices[0]?.message.content?.trim() || "Explanation unavailable." });
    });
}
