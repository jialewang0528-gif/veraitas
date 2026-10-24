import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../app.ts";
import { ApiError, parseJson, positiveDecimal } from "../http.ts";
import { gatewayUserId, requireCustomer, type AppEnv } from "../session.ts";

const exitBody = z.object({
  asset_id: z.string().min(1),
  qty: positiveDecimal,
});

export function quoteRoutes({ gateway, assets }: AppDeps) {
  // What selling `qty` back would return right now. A sell the wallet cannot fund yet still answers with an
  // informational quote and no order, so this prices the exit before the buy. Nothing here is ever signed.
  return new Hono<AppEnv>().post("/orders/exit-quote", requireCustomer, async (c) => {
    const { asset_id, qty } = await parseJson(c, exitBody);
    const asset = assets.byId(asset_id);
    if (!asset?.chain || assets.isCash(asset)) {
      throw new ApiError(400, "invalid_argument", `asset_id: ${asset_id} is not offered for trading`);
    }
    const created = await gateway.createOrder(gatewayUserId(c.var.customer), {
      asset_id: asset.id,
      chain: asset.chain,
      side: "sell",
      qty,
      qty_unit: "base",
    });
    const q = created.quote;
    if (!q) throw new ApiError(502, "unavailable", "True Markets returned no exit quote");
    return c.json({
      qty_out: q.qty_out,
      fee: q.fee,
      fee_asset: assets.symbolOf(q.fee_asset),
      issues: q.issues ?? [],
    });
  });
}
