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
*   **Consistency:** This ensures that the characters like "Ghoul" or "Banana" always look and sound the same.

### 3. AI Pipeline (Publishing Workflow)
The process of automatically creating an article via `/write`:
1.  **Scraping:** The system uses **Jina Reader (r.jina.ai)** to fetch and clean content from external links into structured Markdown.
2.  **Rewriting:** The text is adaptively rewritten using **Gemini 2.0 Flash**, applying the selected **Mood** (Sarcastic, Bullish, etc.) and **DNA**.
3.  **Visual Generation:** A unique banner is generated using specialized image models (**Gemini 3.1 Flash Image** or **FLUX.2**), integrating the character into the scene via complex visual prompts.
4.  **Distribution:** The engine automatically adapts and posts content to the user's connected **Telegram** channels and **Binance Square** accounts.

### 4. Publishing Gate (Economic Barrier)
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
| **Image Engine** | **The visual choice.** Users can select between **Gemini 3.1** (High fidelity), **FLUX.2** (Fast/Native 16:9), and **Gemini 2.5 Flash**. |
| **Thirdweb Client ID** | **The key storage switch.** If a Client ID is provided, the system switches from Supabase Storage to **IPFS**. Your images become decentralized and permanent. |
| **Monetization** | Custom CTA links for Telegram channels, Forums, and Referral networks integrated into every article. |

---

## 🛠 Tech Stack

*   **Frontend:** Next.js 14 (App Router) + TypeScript.
*   **Styling:** Tailwind CSS 4 (Native CSS variable configuration).
*   **Blockchain:** Thirdweb SDK + Base Network.
*   **Database/Auth:** Supabase.
*   **AI Engine:** OpenRouter (Gemini, FLUX), Jina Reader.

---

## 📦 Deployment

1.  Clone the repository.
2.  Configure `.env` (Supabase, Thirdweb, and OpenRouter keys are required).
3.  Run `npm install` and `npm run dev`.
4.  Configure `PINATA_JWT` and `NEXT_PUBLIC_PINATA_GATEWAY` in your server environment (e.g. Vercel or `.env`) for IPFS storage functionality.

---
*Pager — Media owned by those who create and support it. $HASH Power.*
