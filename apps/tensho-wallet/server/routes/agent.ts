import { Hono } from "hono";
import { z } from "zod";
import { EXPLAIN_PROMPT, runAgent } from "../ai/agent.ts";
import { AGENT_MODEL, chat } from "../ai/openrouter.ts";
import type { AppDeps } from "../app.ts";
import { parseJson } from "../http.ts";
import { requireCustomer, type AppEnv } from "../session.ts";
import type { OrderDesk } from "./orders.ts";

const explainBody = z.object({
  label: z.string().min(1).max(80),
  value: z.string().max(200),
  context: z.string().max(400).default(""),
});

const EXPLAIN_TTL_MS = 60_000;

export function agentRoutes(deps: AppDeps, desk: OrderDesk) {
  const explained = new Map<string, { text: string; at: number }>();

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
      const hit = explained.get(key);
      if (hit && Date.now() - hit.at < EXPLAIN_TTL_MS) return c.json({ text: hit.text });

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
    });
}
