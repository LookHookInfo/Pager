# Pager: The Decentralized Web3 Media Protocol

**Pager** is a high-tech media platform on the **Base** network, designed for the **$HASH** token ecosystem. The project combines principles of decentralized finance (DeFi), artificial intelligence (AI), and classic storytelling.

---

## 🏗 System Architecture (Under the Hood)

Pager is built on a hybrid architecture that combines blockchain transactions with traditional cloud computing to ensure speed and scalability.

### 1. Authentication & Sync System
The project uses the **Thirdweb SDK** for wallet interactions.
*   **AccountSync:** On every connection, this component checks for the address in the `profiles` table (Supabase).
*   **Auto-provisioning:** If the user is not in the database, a new profile is created with default settings. This allows users to interact with the platform immediately without filling out registration forms.

### 2. DNA Protocol: The Content Matrix
DNAs (Digital Neural Assets) are JSON configurations stored in `src/lib/character/`. They serve as "instructions" for the AI.
*   **Prompt Engineering as Code:** When using "Magic Rewrite," the system extracts parameters from the DNA (species, clothing style, speech patterns) and dynamically assembles a system prompt for the LLM and a visual prompt for cover generation.
*   **Consistency:** This ensures that the "Ghoul" character always looks and sounds the same, regardless of who initiates the publication.

### 3. AI Pipeline (Publishing Workflow)
The process of automatically creating an article via `/write`:
1.  **Scraping:** A proxy server fetches content from an external link.
2.  **Readability:** The `@mozilla/readability` library cleans the HTML of clutter (ads, menus), leaving only the core content.
3.  **Rewriting:** The text is sent to an LLM with the selected **Mood** (Sarcastic, Bullish, etc.) and **DNA** applied.
4.  **Visual Generation:** A unique banner is generated, integrating the article title into the character's environment.

### 4. Publishing Gate (Economic Barrier)
Publishing on Pager is protected by a "Hash-wall":
*   **Step 1 (On-chain):** The user signs a `transfer` transaction of 10 $HASH to the `PROJECT_WALLET`.
*   **Step 2 (Off-chain Verification):** Only after a successful transaction hash does the frontend call `/api/article/create`.
*   **Step 3 (Database):** A server-side client (Service Role) creates the record in the database, bypassing RLS (Row Level Security) since the payment has already been confirmed by the blockchain.

---

## 👤 Profile Settings & Their Impact

User profiles hide several mechanisms for customizing the protocol's operation:

| Setting | Impact on the System |
| :--- | :--- |
| **User AI API Key** | If provided, AI requests are routed through the user's key. This bypasses platform limits and allows the use of more powerful models. |
| **Thirdweb Client ID** | **The key storage switch.** If a Client ID is provided, the system switches from Supabase Storage to **IPFS**. Your images become decentralized and permanent. |
| **Bio/Name** | Metadata displayed in the `ProfileHeader` and under each article. |

---

## 🛠 Tech Stack

*   **Frontend:** Next.js 14 (App Router) + TypeScript.
*   **Styling:** Tailwind CSS + `tailwindcss-typography` (for perfect article rendering).
*   **Blockchain:** Thirdweb SDK + Base Network.
*   **Database/Auth:** Supabase.
*   **Content Logic:** Mozilla Readability + OpenAI API.

---

## 📡 API & Auto-publishing (Roadmap)

The team is preparing to release a public API that will enable:
1.  **Headless Publishing:** Publishing articles via POST requests directly from Python/Node.js scripts.
2.  **External Oracles:** Integration of live BTC price data directly into the article body via `getBtcAnalysisBlock`.
3.  **Cross-posting:** Automatic reposting of new articles to X (Twitter) and Telegram channels via webhooks.

---

## 📦 Deployment

1.  Clone the repository.
2.  Configure `.env` (Supabase, Thirdweb, and OpenAI keys are required).
3.  Run `npm install` and `npm run dev`.
4.  For IPFS functionality, ensure `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` is correctly configured.

---
*Pager — Media owned by those who create and support it. $HASH Power.*
