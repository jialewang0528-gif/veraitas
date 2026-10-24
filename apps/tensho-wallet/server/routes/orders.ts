import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../app.ts";
import type { Customer } from "../customers.ts";
import { explorerTxUrl } from "../explorer.ts";
import { ApiError, nothingToSign, parseJson, positiveDecimal, quoteExpired } from "../http.ts";
import { QuoteCache } from "../pending.ts";
import { gatewayUserId, requireCustomer, type AppEnv } from "../session.ts";
import { stampAll } from "../tm/stamp.ts";

export const orderBody = z.object({
  asset_id: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  amount: positiveDecimal,
});

export type OrderBody = z.infer<typeof orderBody>;

// Prepares orders and keeps them signable, for the trade ticket and the agent alike, so one execute route serves both.
export function orderDesk({ gateway, assets }: Pick<AppDeps, "gateway" | "assets">) {
  const quotes = new QuoteCache<OrderBody>();

  async function prepare(userId: string, { asset_id, side, amount }: OrderBody) {
    const asset = assets.byId(asset_id);
    if (!asset?.chain || assets.isCash(asset)) {
      throw new ApiError(400, "invalid_argument", `asset_id: ${asset_id} is not offered for trading`);
    }

    const created = await gateway.createOrder(userId, {
      asset_id: asset.id,
      chain: asset.chain,
      side,
      qty: amount,
      qty_unit: side === "buy" ? "quote" : "base",
    });
    const issue = created.quote?.issues?.[0];
    if (issue) throw new ApiError(422, "failed_precondition", issue);
    if (!created.payloads?.length) throw nothingToSign();
    return { ...created, id: created.order_id, payloads: created.payloads };
  }

  async function prepareFor(customer: Customer, request: OrderBody) {
    const created = await prepare(gatewayUserId(customer), request);
    const preparedAt = quotes.put(created.id, customer.id, request, created.payloads);
    return {
      order_id: created.id,
      status: created.status,
      quote: created.quote && {
        ...created.quote,
        base_asset: assets.symbolOf(created.quote.base_asset),
        quote_asset: assets.symbolOf(created.quote.quote_asset),
        fee_asset: assets.symbolOf(created.quote.fee_asset),
      },
      prepared_at: new Date(preparedAt).toISOString(),
    };
  }

  return { quotes, prepare, prepareFor };
}

export type OrderDesk = ReturnType<typeof orderDesk>;

export function orderRoutes(deps: AppDeps, desk: OrderDesk = orderDesk(deps)) {
  const { gateway, assets } = deps;
  return new Hono<AppEnv>()
    .post("/orders", requireCustomer, async (c) => {
      const request = await parseJson(c, orderBody);
      return c.json(await desk.prepareFor(c.var.customer, request));
    })
    .post("/orders/:id/execute", requireCustomer, async (c) => {
      const customer = c.var.customer;
      const userId = gatewayUserId(customer);
      const order = await desk.quotes.signable(c.req.param("id"), customer.id, (request) => desk.prepare(userId, request));
      if (!order) throw quoteExpired();

      const signatures = stampAll(order.payloads);
      const { status } = await gateway.executeOrder(userId, order.id, signatures);
      return c.json({ order_id: order.id, status });
    })
    .get("/orders/:id", requireCustomer, async (c) => {
      const order = await gateway.getOrder(gatewayUserId(c.var.customer), c.req.param("id"));
      // Conductor's single-order read omits the chain, so it never builds the explorer link its list reads carry.
      const chain = order.asset_id ? assets.byId(order.asset_id)?.chain : undefined;
      return c.json({
        ...order,
        explorer_url: order.explorer_url ?? explorerTxUrl(chain, order.tx_hash),
      });
    });
}
