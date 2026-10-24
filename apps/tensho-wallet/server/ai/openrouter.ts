import { env } from "../env.ts";
import { ApiError } from "../http.ts";

const URL = "https://openrouter.ai/api/v1/chat/completions";
export const AGENT_MODEL = "x-ai/grok-4.7";
export const FALLBACK_MODEL = "anthropic/claude-sonnet-5.5";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  plugins?: unknown[];
  max_tokens?: number;
}

export interface ChatResponse {
  choices: {
    message: {
      content: string | null;
      tool_calls?: ToolCall[];
      annotations?: {
        type: string;
        url_citation?: { url: string; title?: string };
      }[];
    };
  }[];
}

export const agentUnavailable = () =>
  new ApiError(503, "unavailable", "Agent unavailable", {
    code: "agent_unavailable",
  });

// Swapped in tests so nothing ever reaches the network.
export const aiDeps = {
  fetch: (input: string, init?: RequestInit): Promise<Response> => fetch(input, init),
  apiKey: (): string | undefined => env.OPENROUTER_API_KEY,
};

async function once(request: ChatRequest, timeoutMs: number): Promise<ChatResponse> {
  const key = aiDeps.apiKey();
  if (!key) throw agentUnavailable();
  const res = await aiDeps.fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "VerAItas",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.warn(`OpenRouter ${request.model} answered ${res.status}: ${detail}`);
    throw new Error(`OpenRouter ${res.status}`);
  }
  return (await res.json()) as ChatResponse;
}

// One retry on the fallback model; anything after that reports the agent as unavailable.
export async function chat(request: ChatRequest, timeoutMs = 45_000): Promise<ChatResponse> {
  if (!aiDeps.apiKey()) throw agentUnavailable();
  try {
    return await once(request, timeoutMs);
  } catch (first) {
    if (first instanceof ApiError) throw first;
    try {
      return await once({ ...request, model: FALLBACK_MODEL }, timeoutMs);
    } catch (second) {
      console.warn(`OpenRouter failed twice: ${String(first)} / ${String(second)}`);
      throw agentUnavailable();
    }
  }
}
