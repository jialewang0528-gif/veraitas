# VerAItas

**Trading, said plainly.** VerAItas helps someone who has never traded answer three questions before they tap buy:

1. **How much could I lose?** Swing Check
2. **What am I really paying?** Receipt First
3. **When will I sell?** Exit Ticket

Built at the NYU Shipyard buildathon for the Fintech Builder track, on the [True Markets Gateway API](https://docs.truemarkets.co/gateway). Trades are real: tokens on Solana and Base, settled in USDC.

## The three screens

### Swing Check
Beginners see "SOL -4%" and don't know what that means for their money. Type an amount and pick a token, and Swing Check turns the last 30 days of True Markets prices into dollars:

> On a normal day, your $20.00 moves about $0.19 up or down. On the worst day this month, your $20.00 would have dropped to $18.84.

A bar for each day shows that day's gain or loss on your amount. Nothing is bought on this screen.

### Receipt First
The price on the chart is not the price you pay. When you buy right away, you pay what the cheapest seller asks, which sits a bit above the chart price. Receipt First shows a receipt before you buy, with **You pay, Market price, Your price, You get and Hidden cost**, refreshed from a live quote every 10 seconds. After the order fills, a second receipt shows what you actually got.

### Exit Ticket
Most first-time traders buy with no plan to sell. On Exit Ticket the Buy button stays locked until you pick a target: **+5%, +10% or +20%**. After the buy fills, VerAItas saves a sell plan from the real fill price and sells automatically once the price reaches your target. You can cancel a plan while it is still watching.

True Markets rests limit orders on its exchange and on Hyperliquid, but not on Solana or Base, so the VerAItas server watches the price every 15 seconds and sells at market when the target is hit. Plans only run while the server is running.

## Guardrails

- Every buy is capped at **$5** on the server, whatever the browser sends.
- The server only signs payloads True Markets returned, never anything from the browser.
- The API key and the wallet signer key stay on your machine and are never committed.

## Run it

The app lives in [`apps/tensho-wallet`](apps/tensho-wallet/). The folder kept its original name so existing clones keep working.

```bash
cd apps/tensho-wallet
npm install
# put the API key JSON from the True Markets developer console in .secrets/
npm run dev
```

Then open http://localhost:5173. You need Node 22 or newer. [The app README](apps/tensho-wallet/README.md) covers setup, how the True Markets calls work, and the warnings to read before funding a wallet.

> [!WARNING]
> There is no sandbox. Every order moves real money. Back up `data/wallet-signer-key` before you fund anything, because losing it locks every wallet the app created.

## Credits

VerAItas started from Tensho Wallet, the neobank example in [true-markets/examples](https://github.com/true-markets/examples). We renamed and restyled it, added a live price chart, and built the three beginner screens on top.
