import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../app.ts";
import { ApiError, parseJson, positiveDecimal } from "../http.ts";
import { gatewayUserId, requireCustomer, type AppEnv } from "../session.ts";
import type { CreateOrderRequest } from "../tm/types.ts";

const exitBody = z.object({
  asset_id: z.string().min(1),
  qty: positiveDecimal,
});

const buyBody = z.object({
  asset_id: z.string().min(1),
  amount: positiveDecimal,
});

// Both routes only read a quote. A wallet that cannot fund the order still gets an informational quote and no
// order; one that can gets an unsigned order that is never executed and expires. Nothing here is ever signed.
export function quoteRoutes({ gateway, assets }: AppDeps) {
  async function estimate(userId: string, assetId: string, order: Pick<CreateOrderRequest, "side" | "qty" | "qty_unit">) {
    const asset = assets.byId(assetId);
    if (!asset?.chain || assets.isCash(asset)) {
      throw new ApiError(400, "invalid_argument", `asset_id: ${assetId} is not offered for trading`);
    }
    const created = await gateway.createOrder(userId, { asset_id: asset.id, chain: asset.chain, ...order });
    const q = created.quote;
    if (!q) throw new ApiError(502, "unavailable", "True Markets returned no quote");
    return {
      qty: q.qty,
      qty_out: q.qty_out,
      fee: q.fee,
      fee_asset: assets.symbolOf(q.fee_asset),
      issues: q.issues ?? [],
    };
  }

  return new Hono<AppEnv>()
    // What selling `qty` back would return right now, priced before the buy.
    .post("/orders/exit-quote", requireCustomer, async (c) => {
      const { asset_id, qty } = await parseJson(c, exitBody);
      return c.json(await estimate(gatewayUserId(c.var.customer), asset_id, { side: "sell", qty, qty_unit: "base" }));
    })
    // What a buy would get, even before the wallet is funded.
    .post("/orders/buy-quote", requireCustomer, async (c) => {
      const { asset_id, amount } = await parseJson(c, buyBody);
      return c.json(await estimate(gatewayUserId(c.var.customer), asset_id, { side: "buy", qty: amount, qty_unit: "quote" }));
    });
}
