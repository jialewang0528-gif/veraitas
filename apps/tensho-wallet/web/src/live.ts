import { useEffect, useState } from "react";

const STREAM = "wss://api.truemarkets.co/v1/defi/market";

// Spot prices pushed about once a second on the public True Markets stream; reconnects if the socket drops.
export function useLivePrices(symbols: string[]): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const key = [...new Set(symbols.map((s) => s.toUpperCase()))].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(STREAM);
      ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", topics: key.split(",").map((s) => `price.${s}`) }));
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as { type?: string; data?: { symbol: string; price: string } };
        if (message.type !== "price" || !message.data) return;
        const { symbol, price } = message.data;
        const value = Number(price);
        if (value > 0) setPrices((prev) => (prev[symbol] === value ? prev : { ...prev, [symbol]: value }));
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws.close();
    };
  }, [key]);

  return prices;
}
