import { useState, type ReactNode } from "react";
import { useAssets } from "../api.ts";
import { chainName, sanitizeDecimal } from "../format.ts";

// Beginners read dollars and cents, so the new screens never show fractions of a cent.
export function cents(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Inline layout so it never depends on the dev server regenerating CSS for new files.
export const twoColumns = (left: number) => ({ display: "grid", gridTemplateColumns: `${left}px minmax(0, 1fr)`, alignItems: "start", gap: 20 }) as const;
import type { AssetRow } from "../types.ts";
import { Label } from "./ui.tsx";

// Matches the server's cap in server/routes/orders.ts.
export const MAX_BUY_USD = 5;

export function useTokenChoice() {
  const assets = useAssets();
  const [assetId, setAssetId] = useState<string>();
  const tokens = assets.data?.filter((a) => !a.cash) ?? [];
  const token = tokens.find((t) => t.asset_id === assetId) ?? tokens.find((t) => t.symbol === "SOL") ?? tokens[0];
  return { tokens, token, setAssetId, error: assets.error };
}

export function TokenSelect({
  tokens,
  value,
  onChange,
  disabled,
}: {
  tokens: AssetRow[];
  value?: string;
  onChange: (assetId: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <Label>Token</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 cursor-pointer rounded-[14px] border border-edge bg-ink px-4 text-base text-text outline-none focus:border-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        {tokens.map((t) => (
          <option key={t.asset_id} value={t.asset_id}>
            {t.name} ({t.symbol}) · {chainName(t.chain)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DollarInput({
  value,
  onChange,
  disabled,
  label = "Amount",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <label className="flex flex-col items-center gap-1.5 pt-2">
      <Label>{label}</Label>
      <span className="flex items-baseline gap-2 text-[56px] font-medium tracking-[-0.04em]">
        <span className="text-muted">$</span>
        <input
          value={value}
          inputMode="decimal"
          placeholder="0"
          disabled={disabled}
          aria-label={`${label} in US dollars`}
          onChange={(e) => onChange(sanitizeDecimal(e.target.value))}
          className="w-[5ch] border-none bg-transparent text-center font-mono text-text outline-none placeholder:text-edge"
        />
      </span>
    </label>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  render,
  disabled,
  label,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  render: (value: T) => ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={String(option)}
          type="button"
          aria-pressed={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`h-10 cursor-pointer rounded-xl border bg-ink text-sm text-text disabled:cursor-not-allowed disabled:opacity-40 ${
            value === option ? "border-text font-bold" : "border-edge"
          }`}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}
