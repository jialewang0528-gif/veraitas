import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../app.ts";
import { addPlan, cancelPlan, planForBuyOrder, plansFor, type ExitPlan } from "../exits.ts";
import { ApiError, parseJson } from "../http.ts";
import { gatewayUserId, requireCustomer, type AppEnv } from "../session.ts";

const planBody = z.object({
  order_id: z.string().min(1),
  target_pct: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(-5), z.literal(-10)]),
});

function publicPlan({ customer_id: _customer, user_id: _user, ...plan }: ExitPlan) {
  return plan;
}

export function exitRoutes({ gateway, assets }: AppDeps) {
  return new Hono<AppEnv>()
    .get("/exit-plans", requireCustomer, (c) => c.json(plansFor(c.var.customer.id).map(publicPlan)))
    .post("/exit-plans", requireCustomer, async (c) => {
      const customer = c.var.customer;
      const userId = gatewayUserId(customer);
      const { order_id, target_pct } = await parseJson(c, planBody);

      const existing = planForBuyOrder(order_id);
      if (existing) {
        if (existing.customer_id !== customer.id) throw new ApiError(404, "not_found", "order not found");
        return c.json(publicPlan(existing));
      }

      // The fill comes from True Markets, never from numbers the browser sends.
      const order = await gateway.getOrder(userId, order_id);
      if (order.side !== "buy" || order.status !== "complete") {
        throw new ApiError(409, "failed_precondition", "the buy has not filled yet");
      }
      const asset =
        (order.asset_id && assets.byId(order.asset_id)) || assets.all().find((a) => a.address === order.base_asset);
      if (!asset || assets.isCash(asset)) throw new ApiError(400, "invalid_argument", "asset is not offered for trading");
      if (!(Number(order.executed_qty) > 0 && Number(order.executed_vwap) > 0)) {
        throw new ApiError(409, "failed_precondition", "the buy has no fill to sell");
      }

      const plan = addPlan({
        customer_id: customer.id,
        user_id: userId,
        asset_id: asset.id,
        symbol: asset.symbol,
        qty: order.executed_qty,
        fill_price: order.executed_vwap,
        target_pct,
        buy_order_id: order_id,
      });
      console.log(`exit plan ${plan.id}: sell ${plan.qty} ${plan.symbol} at ${plan.target_price} (bought at ${plan.fill_price})`);
      return c.json(publicPlan(plan), 201);
    })
    .post("/exit-plans/:id/cancel", requireCustomer, (c) => {
      const plan = cancelPlan(c.req.param("id"), c.var.customer.id);
      if (!plan) throw new ApiError(409, "failed_precondition", "only a plan that is still watching can be canceled");
      return c.json(publicPlan(plan));
    });
}
