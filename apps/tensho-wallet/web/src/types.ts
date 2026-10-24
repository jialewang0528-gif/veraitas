export interface Wallet {
  chain_family: string;
  address: string;
}

export interface Profile {
  email: string;
  wallets: Wallet[];
  ready: boolean;
  warning?: string;
}

export interface AssetRow {
  asset_id: string;
  symbol: string;
  name: string;
  chain: string | null;
  icon: string | null;
  price: string | null;
  change_24h: string | null;
  as_of: string | null;
  cash: boolean;
}

export interface BalanceItem {
  asset_id?: string;
  symbol: string;
  name: string;
  chain: string | null;
  decimals: number;
  total: string;
  available: string;
  held: string;
  stable: boolean;
  tradeable: boolean;
}

export interface PortfolioBalance extends BalanceItem {
  icon: string | null;
  price: string | null;
  value: string | null;
  change_24h_pct: string | null;
}

export interface PricedPortfolio {
  priced?: undefined;
  total_usd: string;
  change_24h_usd: string;
  change_24h_pct: string;
  balances: PortfolioBalance[];
}

export interface UnpricedPortfolio {
  priced: false;
  balances: BalanceItem[];
}

export type Portfolio = PricedPortfolio | UnpricedPortfolio;

export interface Quote {
  base_asset: string;
  quote_asset: string;
  qty: string;
  qty_out: string;
  fee: string;
  fee_asset: string;
}

export interface PreparedOrder {
  order_id: string;
  status: string;
  quote?: Quote;
  prepared_at: string;
}

export interface OrderDetail {
  order_id: string;
  asset_symbol?: string;
  base_asset: string;
  side: "buy" | "sell";
  qty: string;
  executed_qty: string;
  executed_vwap: string;
  status: string;
  explorer_url?: string;
  failure_reason?: string;
  created_at: string;
}

export interface PreparedTransfer {
  transfer_id: string;
  status: string;
  fee: string;
  qty: string;
  prepared_at: string;
}

export interface TransferDetail {
  id: string;
  status: string;
  asset_symbol: string;
  chain: string | null;
  to: string;
  qty: string;
  qty_unit: "base" | "quote";
  sent: string;
  explorer_url: string | null;
  created_at: string;
}

export interface TransactionDetail {
  id: string;
  type: "order" | "transfer" | "ramp";
  asset_flow: "in" | "out";
  status: "pending" | "completed" | "failed" | "canceled";
  created_at: string;
  qty: string | null;
  asset_symbol: string | null;
  explorer_url: string | null;
  failure_reason: string | null;
  order?: OrderDetail;
  transfer?: TransferDetail;
}

export type ChartRange = "1H" | "1D" | "1W" | "1M";

export interface MarketData {
  symbol: string;
  range: ChartRange;
  points: { t: string; price: string }[];
  stats: {
    market_cap: string | null;
    volume_24h: string | null;
    low_24h: string | null;
    high_24h: string | null;
  };
}

export interface Page<T> {
  data: T[];
  pagination: { next_cursor: string | null; limit: number };
}

export type ExitStatus = "watching" | "selling" | "sold" | "failed" | "canceled";

export interface ExitPlan {
  id: string;
  asset_id: string;
  symbol: string;
  qty: string;
  fill_price: string;
  target_pct: 5 | 10 | 20 | -5 | -10;
  target_price: string;
  status: ExitStatus;
  buy_order_id: string;
  sell_order_id: string | null;
  sold_price: string | null;
  failure: string | null;
  created_at: string;
  updated_at: string;
}
