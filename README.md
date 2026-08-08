# Pager: The Decentralized Web3 Media Protocol

**Pager** is a high-tech media platform on the **Base** network, designed for the **$HASH** token ecosystem. The project combines principles of decentralized finance (DeFi), artificial intelligence (AI), and classic storytelling. Users create **NFT mascots** with their own DNA (personality, voice, appearance), then publish AI-rewritten crypto articles with banners that show their own mascot.

---

## 🏗 System Architecture (Under the Hood)

Pager is built on a hybrid architecture that combines blockchain transactions (Base / Thirdweb SDK) with traditional cloud computing (Supabase, AnyModel, Pinata) to ensure speed and scalability.

### 1. Authentication & Sync System
The project uses the **Thirdweb SDK** for wallet interactions.
*   **AccountSync:** On every connection, this component checks for the address in the `profiles` table (Supabase).
*   **Auto-provisioning:** If the user is not in the database, a new profile is created with default settings. This allows users to interact with the platform immediately without filling out registration forms.

### 2. DNA Protocol: NFT Mascots
Mascots are NFTs on the **Base** network. Their DNA lives in two places, resolved in order:

1.  **On-chain metadata** — the contract `uri(tokenId)` is fetched; if the metadata JSON contains a `pager_dna` object (`src/lib/character/nft.ts`), it is used.
2.  **`mascots_dna` table (Supabase)** — fallback. Keyed by `tokenId`, columns: `name`, `personality`, `voice`, `physical_desc`, `image_url`, `creator_address`, `price`, `contract_address`. This is where mascots created via the forge UI land.

`resolveDna(tokenId)` (`src/lib/character/resolve.ts`) normalizes either source into a `CustomDna { name, personality, voice, physical_description, image_url }`, which drives both article rewriting and banner generation.

### 3. Creating a Mascot (Forge) — `/mascots`
1.  **Image upload** → `/api/upload` → pinned to **IPFS (Pinata)** → `image_url`.
2.  **AI DNA scan** (`/api/ai/analyze`, Gemini via AnyModel) optionally extracts `personality`, `voice`, `visual_desc` from the image.
3.  **Required fields:** `name`, `personality`, `image_url`, `price` (`voice`, `visual_desc` optional).
4.  A row is `upsert`ed into `mascots_dna` with `id = nextTokenId` **before** minting, so the DB is always in sync with the contract.
5.  `createMascot(price)` runs on-chain (with a `$HASH` approval of `CREATION_FEE`).

### 4. AI Pipeline (Publishing Workflow) — `/write`
1.  **Mascot selection:** `getUserMascots(address)` (on-chain) → active owned token IDs → matched against `mascots_dna` → the user picks a mascot (default: profile `ai_nft_token_id`, else first owned).
2.  **Scraping:** **Jina Reader (r.jina.ai)** fetches and cleans content from an external URL into structured Markdown.
3.  **Rewriting:** The text is rewritten with **Gemini 3.1 Flash-Lite (via AnyModel)** applying the selected **Mood** (Sarcastic, Bullish, Bearish, Humorous, Negative, FOMO, Happy, Neutral) and the mascot's **DNA** (`personality` + `voice`) from `getCharacterSystemPrompt`.
4.  **Visual generation:** See the *Banner Pipeline* below.
5.  **Distribution:** The engine adapts and posts content to the user's connected **Telegram** channels and **Binance Square** accounts.

### 5. Banner Pipeline (how a banner is actually made)
The banner always depicts **the user's chosen mascot**. Two mechanisms enforce this:

*   **Reference image (I2I):** the mascot's `image_url` is sent to AnyModel as the `input_image` reference (`src/lib/image.ts` → `generateAnyModelImage`). Only models with image-to-image support use it; others simply ignore it.
*   **Appearance DNA:** the mascot's `physical_description` is embedded in the prompt. Only the *character core* (~400 chars: proportions, skin/fur, eyes, clothing) is used — environment/style sections are dropped so they don't conflict with the selected atmosphere.

**Safety design:** the image prompt (`getCharacterVisualPrompt` in `src/lib/character/index.ts`) is built **only** from controlled inputs — mascot DNA appearance + `mood`/`atmosphere` enums. Raw user article content (title, article text, scene descriptions) is **never** included, because image models hard-block arbitrary user text. Inputs are validated:

*   `atmosphere` must be one of `Surrealism | Pixel Art | Brick Style | Anime Style | Graffiti | Comics`, otherwise → `Surrealism`.
*   `mood` must be in the known `MOODS`, otherwise → `neutral`.
*   `sanitizeBannerPrompt()` swaps trademarked terms (e.g. `Pepe the Frog` → `a cheerful green frog`) before the prompt reaches the engine.

**Execution flow (`POST /api/ai/banner`) — synchronous:**

1.  Session verification + **atomic debit of 10 $HASH credits** (`ai_credits`).
2.  `resolveDna(nftTokenId)` → if no DNA: refund + `404`.
3.  Build + sanitize the prompt; call **`generateAnyModelImage`** (`ag/gemini-3.1-flash-image`, 1280×720, sync, budget-bounded via `withBudget`). The mascot reference is passed as a base64 data URL.
4.  On success the image is compressed to WebP (**sharp**), pinned to **IPFS (Pinata)**, and the ready gateway URL is returned inline (`image_engine: "anymodel"`).
5.  On total failure the 10 credits are **refunded** (`atomicRefundCredits`) and a branded **SVG placeholder** (`generateSvgBanner`) is returned so the article still gets a banner.

Because generation is synchronous, the client `requestBannerJob` (`src/lib/banner-client.ts`) waits up to 120s for the inline result and never auto-retries (the endpoint is paid and non-idempotent). `maxDuration = 60` covers the AnyModel call + pinning (Vercel Hobby cap).

### 6. Publishing Gate (Economic Barrier)
Publishing on Pager is protected by a "Hash-wall":
*   **Step 1 (On-chain):** The user signs a `transfer` transaction of 10 $HASH to the `PROJECT_WALLET`.
*   **Step 2 (Off-chain Verification):** Only after a successful transaction hash does the frontend call `/api/article/create`.
*   **Step 3 (Database):** A server-side client (Service Role) creates the record in the database, bypassing RLS (Row Level Security).

---

## 👤 Profile Settings & Their Impact

User profiles hide several mechanisms for customizing the protocol's operation:

| Setting | Impact on the System |
| :--- | :--- |
| **User AI API Key** | If provided, AI requests are routed through the user's key. This bypasses platform limits and allows the use of personal distribution protocols. |
| **Image Engine** | **Banner rendering.** Banners are generated with **Gemini 3.1 Flash-Image (AnyModel)** using the mascot reference image; an **SVG placeholder** is the final fallback. Every banner costs **10 AI credits** and is pinned to IPFS via Pinata. |
| **Thirdweb Client ID** | **The key storage switch.** If a Client ID is provided, the system switches from Supabase Storage to **IPFS**. Your images become decentralized and permanent. |
| **Monetization** | Custom CTA links for Telegram channels, Forums, and Referral networks integrated into every article. |

---

## 🛠 Tech Stack

*   **Frontend:** Next.js 14 (App Router) + TypeScript.
*   **Styling:** Tailwind CSS 4 (Native CSS variable configuration).
*   **Blockchain:** Thirdweb SDK + Base Network (mascot NFT contract, $HASH token).
*   **Database/Auth:** Supabase (`profiles`, `mascots_dna`).
*   **AI Engine:** AnyModel (Gemini 3.1 Flash-Lite text / Gemini 3.1 Flash-Image banners), Jina Reader (scraping).
*   **Media:** Pinata (IPFS), sharp (WebP compression).

---

## 🔑 Environment Variables

Required in `.env` / Vercel:

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side (RLS bypass) access |
| `ANYMODEL_API_KEY` | AnyModel gateway key (text + image generation) |
| `ANYMODEL_TEXT_MODEL` | Text model for all LLM calls (`gc/gemini-3.1-flash-lite-preview`) |
| `ANYMODEL_IMAGE_MODEL` | Banner image model (`ag/gemini-3.1-flash-image`) |
| `ANYMODEL_IMAGE_SIZE` | Banner size — only `1024x1024`, `1536x1024`, `1280x720` are accepted (`1280x720` = 16:9) |
| `JINA_API_KEY` | Jina Reader scraping (`/api/ai/scrape`) |
| `PINATA_JWT` | IPFS pinning (JWT auth) |
| `PINATA_API_KEY` / `PINATA_API_SECRET` | IPFS pinning (key/secret auth fallback) |
| `NEXT_PUBLIC_PINATA_GATEWAY` | Public gateway for pinned assets |

Pinata keys must include the `pinFileToIPFS` scope (a key without it fails with `403 NO_SCOPES_FOUND`).

---

## 📦 Deployment

1.  Clone the repository.
2.  Configure `.env` (Supabase, Thirdweb, AnyModel, Pinata keys).
3.  Run `npm install` (this also re-syncs `yarn.lock` — a stale lockfile breaks Vercel's `--frozen-lockfile` build) and `npm run dev`.
4.  Deploy to Vercel. `/api/ai/banner` runs synchronously (AnyModel + SVG fallback) with `maxDuration = 60` (Vercel Hobby cap); the client waits up to 120s for the inline result.

---

*Pager — Media owned by those who create and support it. $HASH Power.*
