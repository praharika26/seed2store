# Seed2Store

**Certified crops, traded direct.** Growers list lots with a tamper-evident certificate of origin and sell straight to buyers through buy-now, private offers or open auctions. Every lot's provenance is fingerprinted with keccak-256 and can be minted as an ERC-721 token, so anyone downstream can verify where, when and how it was grown, from seed to store.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, MongoDB, ethers v6 and Solidity (Hardhat).

---

## Quick start (zero config)

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app boots with a seeded demo market of growers, lots, live auctions, offers and order history. Without `MONGODB_URI` it uses a local file (`.data/seed2store.json`) so you can try it instantly; for real use, connect MongoDB (below).

Click **Connect wallet**, then either:
- use any browser wallet (MetaMask, Rabby, Coinbase Wallet, Brave…), discovered via EIP-6963, or
- pick **Burner wallet** to explore instantly with a throwaway key kept in your browser.

Sign-in is a free signed message (no gas). Switch between **Buyer** and **Farmer** mode from the account menu.

## Turn on the blockchain

```bash
npm run chain          # terminal 1: Hardhat node on :8545 (chain 31337)
npm run deploy:local   # terminal 2: deploys Seed2StoreNFT and writes .env.local
npm run dev            # restart so Next.js picks up the contract address
```

With a contract configured:

| Action | What happens on-chain |
|---|---|
| **Mint certificate** | `createCropCertificate` mints an ERC-721 to the grower. `tokenURI` points at the lot's metadata (IPFS when Pinata is set, else `/api/metadata/:id`). |
| **Buy now** | `directPurchase` pays the grower (minus a 2.5% platform fee) and transfers the NFT to the buyer in one transaction. |
| **Auction** | `createAuction` → `placeBid` escrows ETH and refunds the previous leader automatically. Bids in the last 10 minutes extend the clock. `finalizeAuction` pays out and transfers the NFT, or refunds if the reserve wasn't met. |
| **Verify** | `/verify` reads the token from the chain and compares the issuer with the off-chain record. |

The burner wallet auto-funds itself on local chains (`hardhat_setBalance` / Ganache's `evm_setAccountBalance`), so you can run the whole flow without MetaMask. Certified lots trade whole and must settle on-chain; the API rejects off-chain shortcuts for them.

Prices are entered in USD and converted at `NEXT_PUBLIC_ETH_USD` (default `2500`). Without a contract, everything still works off-chain: lots are content-hashed, and payment is confirmed between the parties.

Other networks: `npm run deploy:ganache` (port 7545, chain 1337) or `npm run deploy:sepolia` (set `PRIVATE_KEY`).

## MongoDB

Add to `.env.local` (local server or Atlas):

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=seed2store
```

Restart `npm run dev`. Everything is then written to MongoDB:

| Collection | Contents |
|---|---|
| `users` | wallets, role, profile (unique index on `wallet_address`) |
| `crops` | lots with provenance, prices, certificate hash and NFT linkage |
| `auctions`, `bids` | auctions, bid ladder, settlement and on-chain IDs |
| `offers`, `orders` | negotiations and the order lifecycle |
| `notifications` | per-user activity feed |
| `uploads.files` / `uploads.chunks` | lot photos (GridFS, content-addressed by SHA-256) |
| `meta` | the generated session-signing secret (unless `AUTH_SECRET` is set) |

On first start the app creates the indexes and, if the database is empty, seeds the demo market (`MONGODB_SEED=false` to start empty). Documents use the domain ID as `_id`; timestamps are ISO-8601 strings.

Every state change that could race uses an atomic compare-and-set (`findOneAndUpdate` with the expected state in the filter): two buyers hitting buy-now at once, simultaneous bids, accepting an offer while it's being withdrawn, double auction settlement, order status transitions. Exactly one request wins and the other gets a clear 409.

`npm run db:reset` drops the database (photos included) so the next start re-seeds.

Optional extras: `PINATA_JWT` pins photos and token metadata to IPFS instead of GridFS, and `AUTH_SECRET` sets the session key explicitly. See `.env.example`; `/status` shows what the running deployment is connected to.

> On serverless hosts (e.g. Vercel), set `MONGODB_URI`; the local-file fallback needs a writable disk.

## Features

- **Marketplace:** full-text search across title, variety, origin and grower; crop chips; organic filter; buy-now vs auction tabs; sorting by price or soonest ending; pagination; URL-synced filters.
- **Lot pages:** gallery, specs, live auction panel with countdown, quick-bid chips and reserve status; buy-now with a confirmation summary; private offers; bid history; provenance panel.
- **Certificate of origin:** a keccak-256 fingerprint over the immutable provenance fields (quantity and prices deliberately excluded), with a human serial like `S2S-695D-EB66`. Any later edit is detectable on `/verify`.
- **Growers:** step-by-step listing with a live certificate preview and drag-and-drop photos; auctions with reserve, duration and anti-sniping; offer inbox with accept/decline plus a note; withdraw and relist lots.
- **Orders:** opened automatically by buy-now, accepted offers or auctions that close above reserve; then payment confirmed → shipped → delivered, with cancellation that returns goods to market.
- **Dashboard:** role-aware stats, 30-day cumulative revenue or spend chart, sales by crop, and a "needs your attention" queue.
- **Notifications:** outbid, new bid, new offer, accepted or declined, won, shipped, delivered, all deep-linked.
- **Auth:** signed-message sign-in with stateless HMAC session cookies (works on serverless). Every write is authorised server-side; the old API trusted any `wallet_address` in the request body.
- **Design:** "Harvest Noir" dark theme (default) and "Field Paper" light theme, with generative field artwork for lots without photos and a reduced-motion-safe certificate reveal.

## Scripts

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest: the business-rule + concurrency suite on both the local store and a real MongoDB (`MONGODB_TEST_URI`, default `mongodb://127.0.0.1:27017`, skipped if unreachable), plus date validation |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run chain` / `compile` / `deploy:*` | Hardhat |
| `npm run db:reset` | Drop the MongoDB database (or delete the local file); demo data re-seeds on next start |

## Project layout

```
app/                  routes (pages + /api route handlers)
components/           UI: certificate, crop-art, lot/*, site header/footer, shadcn/ui
contracts/            Seed2StoreNFT.sol (certificates, auctions, direct purchase)
lib/server/           store (MongoDB | local JSON), services (all business rules), session, ipfs, chain
lib/wallet/           wallet provider (EIP-6963 + burner), contract + lot-action hooks
lib/                  shared types, config, formatting, certificate hashing
legacy/, docs/legacy/ original contracts and docs, kept for reference
```

The business rules live in one place (`lib/server/services.ts`) and run identically on both storage backends.
