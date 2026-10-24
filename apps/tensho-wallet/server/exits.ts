import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetCatalog } from "./assets.ts";
import type { PriceBook } from "./prices.ts";
import { DATA_DIR } from "./secrets.ts";
import { errorMessage } from "./tm/errors.ts";
import type * as gatewayApi from "./tm/gateway.ts";
import { stampAll } from "./tm/stamp.ts";

// Auto-sell: after a buy fills, the customer can pick a take-profit (sell once the price is up 5, 10 or 20%)
// or a stop-loss (sell once it is down 5 or 10%). True Markets only rests limit orders on its exchange and
// Hyperliquid, not on Solana or Base, so this server watches the price and sells at market once it is reached.

export const EXIT_TARGETS = [5, 10, 20, -5, -10] as const;
export type ExitTarget = (typeof EXIT_TARGETS)[number];
export type ExitStatus = "watching" | "selling" | "sold" | "failed" | "canceled";

export interface ExitPlan {
  id: string;
  customer_id: string;
  user_id: string;
  asset_id: string;
  symbol: string;
  qty: string;
  fill_price: string;
  target_pct: ExitTarget;
  target_price: string;
  status: ExitStatus;
  buy_order_id: string;
  sell_order_id: string | null;
  sold_price: string | null;
  failure: string | null;
  created_at: string;
  updated_at: string;
}

export type NewExitPlan = Pick<
  ExitPlan,
  "customer_id" | "user_id" | "asset_id" | "symbol" | "qty" | "fill_price" | "target_pct" | "buy_order_id"
>;

const FILE = join(DATA_DIR, "exit-plans.json");

const plans: ExitPlan[] = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as { plans: ExitPlan[] }).plans : [];

function persist(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify({ plans }, null, 2));
  renameSync(tmp, FILE);
}

function update(plan: ExitPlan, changes: Partial<ExitPlan>): ExitPlan {
  Object.assign(plan, changes, { updated_at: new Date().toISOString() });
  persist();
  return plan;
}

export function targetPrice(fillPrice: string, targetPct: ExitTarget): string {
  return String(Number((Number(fillPrice) * (1 + targetPct / 100)).toPrecision(10)));
}

// Take-profits trigger at or above the target, stop-losses at or below it.
export function targetReached(plan: Pick<ExitPlan, "target_pct" | "target_price">, price: number): boolean {
  if (!Number.isFinite(price)) return false;
  return plan.target_pct > 0 ? price >= Number(plan.target_price) : price <= Number(plan.target_price);
}

export function plansFor(customerId: string): ExitPlan[] {
  return plans.filter((p) => p.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function planForBuyOrder(buyOrderId: string): ExitPlan | undefined {
  return plans.find((p) => p.buy_order_id === buyOrderId);
}

export function addPlan(input: NewExitPlan): ExitPlan {
  const now = new Date().toISOString();
  const plan: ExitPlan = {
    ...input,
    id: randomUUID(),
    target_price: targetPrice(input.fill_price, input.target_pct),
    status: "watching",
    sell_order_id: null,
    sold_price: null,
    failure: null,
    created_at: now,
    updated_at: now,
  };
  plans.push(plan);
  persist();
  return plan;
}

export function cancelPlan(id: string, customerId: string): ExitPlan | undefined {
  const plan = plans.find((p) => p.id === id && p.customer_id === customerId);
  if (!plan || plan.status !== "watching") return undefined;
  console.log(`exit plan ${plan.id}: canceled by customer`);
  return update(plan, { status: "canceled" });
}

export interface WatcherDeps {
  gateway: typeof gatewayApi;
  assets: AssetCatalog;
  prices: PriceBook;
}

async function sell(plan: ExitPlan, { gateway, assets }: WatcherDeps): Promise<void> {
  const asset = assets.byId(plan.asset_id);
  if (!asset?.chain) throw new Error(`${plan.symbol} is no longer offered for trading`);
  const created = await gateway.createOrder(plan.user_id, {
    asset_id: asset.id,
    chain: asset.chain,
    side: "sell",
    qty: plan.qty,
    qty_unit: "base",
  });
  const issue = created.quote?.issues?.[0];
  if (issue) throw new Error(issue);
  if (!created.order_id || !created.payloads?.length) throw new Error("True Markets returned nothing to sign");
  const { status } = await gateway.executeOrder(plan.user_id, created.order_id, stampAll(created.payloads));
  console.log(`exit plan ${plan.id}: sell of ${plan.qty} ${plan.symbol} submitted as order ${created.order_id} (${status})`);
  update(plan, { sell_order_id: created.order_id });
}

export async function checkPlan(plan: ExitPlan, deps: WatcherDeps): Promise<void> {
  if (plan.status === "watching") {
    const price = Number(deps.prices.get(plan.symbol).price);
    if (!targetReached(plan, price)) return;
    console.log(`exit plan ${plan.id}: ${plan.symbol} at ${price} reached target ${plan.target_price}, selling`);
    // Mark it before any await so an overlapping tick never sells twice.
    update(plan, { status: "selling" });
    try {
      await sell(plan, deps);
    } catch (err) {
      console.warn(`exit plan ${plan.id}: sell failed: ${errorMessage(err)}`);
      update(plan, { status: "failed", failure: errorMessage(err) });
    }
    return;
  }
  if (plan.status === "selling" && plan.sell_order_id) {
    const order = await deps.gateway.getOrder(plan.user_id, plan.sell_order_id);
    if (order.status === "complete") {
      console.log(`exit plan ${plan.id}: sold at ${order.executed_vwap}`);
      update(plan, { status: "sold", sold_price: order.executed_vwap });
    } else if (order.status === "failed" || order.status === "canceled") {
      update(plan, { status: "failed", failure: order.failure_reason ?? `the sell order was ${order.status}` });
    }
  }
}

export function startExitWatcher(deps: WatcherDeps, intervalMs = 15_000): void {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (const plan of plans.filter((p) => p.status === "watching" || p.status === "selling")) {
        await checkPlan(plan, deps).catch((err: unknown) =>
          console.warn(`exit plan ${plan.id}: check failed: ${errorMessage(err)}`),
        );
      }
    } finally {
      running = false;
    }
  }, intervalMs);
}
