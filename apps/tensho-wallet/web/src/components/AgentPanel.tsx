import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Globe,
  LineChart,
  LoaderCircle,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { api, ApiError } from "../api.ts";
import { tokenAmount } from "../format.ts";
import { richText } from "../rich.tsx";
import type { AssetRow, OrderDetail, Quote } from "../types.ts";
import { BeforeYouBuy, HoldButton } from "./BeforeYouBuy.tsx";
import { Card, Label } from "./ui.tsx";

interface Step {
  tool: string;
  label: string;
}

interface Prepared {
  order_id: string;
  asset_id: string;
  symbol: string;
  side: "buy" | "sell";
  amount: string;
  quote?: Quote;
}

interface AgentReply {
  reply: string;
  steps: Step[];
  sources: { url: string; title?: string }[];
  prepared?: Prepared;
}

type Turn =
  | { role: "user"; content: string }
  | ({ role: "assistant"; content: string } & Omit<AgentReply, "reply">);

const STEP_ICON: Record<string, LucideIcon> = {
  search_web: Globe,
  get_market: LineChart,
  get_portfolio: Wallet,
  estimate_buy: LineChart,
  prepare_order: Sparkles,
};

const SUGGESTIONS = [
  "Why is SOL moving today?",
  "Market sentiment on BONK",
  "Compare JUP and RAY",
  "Buy $2 of SOL",
];
const TERMINAL = ["complete", "failed", "canceled"];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PreparedTrade({
  trade,
  tokens,
}: {
  trade: Prepared;
  tokens: AssetRow[];
}) {
  const queryClient = useQueryClient();
  const execute = useMutation({
    mutationFn: () =>
      api<{ order_id: string }>(
        `/api/orders/${encodeURIComponent(trade.order_id)}/execute`,
        { method: "POST" },
      ),
  });
  const settled = useQuery({
    queryKey: ["agent-order", trade.order_id],
    queryFn: () =>
      api<OrderDetail>(`/api/orders/${encodeURIComponent(trade.order_id)}`),
    enabled: execute.isSuccess,
    refetchInterval: (q) =>
      TERMINAL.includes(q.state.data?.status ?? "") ? false : 2000,
  });
  const status = settled.data?.status;
  useEffect(() => {
    if (status !== "complete") return;
    void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }, [status, queryClient]);

  const token = tokens.find((t) => t.asset_id === trade.asset_id);
  if (execute.isSuccess) {
    const text =
      status === "complete"
        ? `${trade.side === "buy" ? "Bought" : "Sold"} ${tokenAmount(settled.data?.executed_qty ?? "0", trade.symbol)}.`
        : status && TERMINAL.includes(status)
          ? `Not filled: ${settled.data?.failure_reason ?? status}. Nothing moved.`
          : "Submitted. Waiting for the network.";
    return (
      <div
        role="status"
        className="rounded-[14px] border border-edge bg-ink px-4 py-3 text-[13px]"
      >
        {text}
        {settled.data?.explorer_url && (
          <a
            className="ml-2 text-xs"
            href={settled.data.explorer_url}
            target="_blank"
            rel="noreferrer"
          >
            View on explorer
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {trade.side === "buy" && token ? (
        <BeforeYouBuy
          token={token}
          spend={Number(trade.amount)}
          quote={trade.quote}
          canConfirm={!execute.isPending}
          onConfirm={() => execute.mutate()}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-[14px] border border-edge bg-ink p-4">
          <Label>Sell {tokenAmount(trade.amount, trade.symbol)}</Label>
          <span className="text-[13px] text-muted">
            You get ~
            {trade.quote
              ? `$${Number(trade.quote.qty_out).toFixed(2)}`
              : "Unavailable"}
            . Estimate.
          </span>
          <HoldButton
            label={`Hold to sell ${trade.symbol}`}
            disabled={execute.isPending}
            onComplete={() => execute.mutate()}
          />
        </div>
      )}
      {execute.error && (
        <span className="text-xs text-down">{execute.error.message}</span>
      )}
    </div>
  );
}

// The conversation lives outside React, so a page refresh of the Trade view can't drop an answer in flight.
interface AgentState {
  turns: Turn[];
  pending: boolean;
  error: Error | null;
}

let agentState: AgentState = { turns: [], pending: false, error: null };
const listeners = new Set<() => void>();

function setAgentState(next: Partial<AgentState>) {
  agentState = { ...agentState, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function askAgent(content: string) {
  if (agentState.pending) return;
  const history: Turn[] = [...agentState.turns, { role: "user", content }];
  setAgentState({ turns: history, pending: true, error: null });
  try {
    const res = await api<AgentReply>("/api/agent/chat", {
      method: "POST",
      body: {
        messages: history.map((t) => ({ role: t.role, content: t.content })),
      },
    });
    setAgentState({
      turns: [
        ...agentState.turns,
        {
          role: "assistant",
          content: res.reply,
          steps: res.steps,
          sources: res.sources,
          prepared: res.prepared,
        },
      ],
      pending: false,
    });
  } catch (err) {
    setAgentState({
      pending: false,
      error: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

export function AgentPanel({ tokens }: { tokens: AssetRow[] }) {
  const { turns, pending, error } = useSyncExternalStore(
    subscribe,
    () => agentState,
  );
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, pending]);

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setDraft("");
    void askAgent(content);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(draft);
  }

  const unavailable = error instanceof ApiError && error.status === 503;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent text-ink">
            <Sparkles aria-hidden className="size-3.5" strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-[15px] font-bold">
              VerAItas Agent
            </span>
            <span className="text-[11px] text-faint">
              Searches the web, reads live True Markets data, prepares trades
            </span>
          </div>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => setAgentState({ turns: [], error: null })}
            className="cursor-pointer border-none bg-transparent text-[11px] font-bold tracking-[0.12em] text-muted uppercase hover:text-text"
          >
            Clear
          </button>
        )}
      </header>

      <div
        ref={scroller}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
        aria-live="polite"
      >
        {turns.length === 0 && (
          <div className="m-auto flex max-w-[420px] flex-col items-center gap-4 text-center">
            <p className="m-0 text-sm text-muted">
              Ask about news, sentiment or prices, or tell it what to trade.
              Trades need your hold to confirm.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="cursor-pointer rounded-full border border-edge bg-transparent px-3.5 py-2 text-xs text-text transition-colors duration-200 hover:border-text"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div
              key={i}
              className="max-w-[80%] self-end rounded-[14px] rounded-br-[4px] bg-line px-4 py-2.5 text-sm"
            >
              {turn.content}
            </div>
          ) : (
            <div
              key={i}
              className="flex max-w-[92%] flex-col gap-2.5 self-start"
            >
              {turn.steps.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {turn.steps.map((step, j) => {
                    const Icon = STEP_ICON[step.tool] ?? Sparkles;
                    return (
                      <li
                        key={j}
                        className="flex items-center gap-2 text-[12px] text-faint"
                      >
                        <Icon
                          aria-hidden
                          className="size-3.5"
                          strokeWidth={1.75}
                        />
                        {step.label}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap">
                {richText(turn.content)}
              </p>
              {turn.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {turn.sources.slice(0, 6).map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      title={s.title}
                      className="rounded-full border border-edge px-2.5 py-1 text-[11px] text-muted no-underline hover:border-text hover:text-text"
                    >
                      {hostOf(s.url)}
                    </a>
                  ))}
                </div>
              )}
              {turn.prepared && (
                <PreparedTrade trade={turn.prepared} tokens={tokens} />
              )}
            </div>
          ),
        )}
        {pending && (
          <div className="flex items-center gap-2 self-start text-[12px] text-muted">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            Researching and checking live data
          </div>
        )}
        {error && (
          <div role="alert" className="self-start text-[13px] text-down">
            {unavailable ? "Agent unavailable." : error.message}
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-line px-3 py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about a coin, or say what to buy"
          aria-label="Message the VerAItas Agent"
          className="h-11 flex-1 rounded-full border border-edge bg-transparent px-4 text-sm text-text outline-none transition-colors duration-200 focus:border-text"
        />
        <button
          type="submit"
          disabled={!draft.trim() || pending}
          aria-label="Send"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-accent text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp aria-hidden className="size-4" strokeWidth={2.25} />
        </button>
      </form>
    </Card>
  );
}
