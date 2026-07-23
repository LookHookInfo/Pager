# News Parsing System — Technical Documentation

## Overview

The system fetches crypto news from 12 RSS feeds, parses them into a unified format, and displays them in a feed UI. Users can click an article to rewrite it with AI. For automation, articles are scraped with Jina, rewritten by LLM, and published.

---

## Architecture

```
[12 RSS Feeds] ──→ [API: /api/news] ──→ [Frontend: /news page]
                                              │
                                         User clicks article
                                              │
                                              ▼
                                      [API: /api/ai/scrape]  ←── Jina Reader API
                                              │
                                              ▼
                                      [API: /api/ai/text]    ←── OpenRouter (Gemini 2.5 Flash)
                                              │
                                              ▼
                                      [API: /api/ai/banner]  ←── BFL Flux 2 Pro
                                              │
                                              ▼
                                      [API: /api/article/create]  ←── Supabase insert
```

---

## Step 1: RSS Feed Aggregation

### File: `src/app/api/news/route.ts`

**Endpoint:** `GET /api/news?source=CoinDesk&limit=40`

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `source` | string | all | Filter by source name (case-insensitive) |
| `limit` | number | 30 | Max items to return (capped at 100) |

**RSS Sources (12 feeds):**

| Name | RSS URL | Category |
|------|---------|----------|
| CoinDesk | `https://www.coindesk.com/arc/outboundfeeds/rss/` | general |
| CoinTelegraph | `https://cointelegraph.com/rss` | general |
| The Block | `https://www.theblock.co/rss.xml` | research |
| Decrypt | `https://decrypt.co/feed` | web3 |
| Bitcoin Magazine | `https://bitcoinmagazine.com/feed` | bitcoin |
| Unchained | `https://unchainedcrypto.com/feed/` | defi |
| The Defiant | `https://thedefiant.io/feed` | defi |
| DL News | `https://www.dlnews.com/rss/` | research |
| BeInCrypto | `https://beincrypto.com/feed/` | analysis |
| CryptoSlate | `https://cryptoslate.com/feed/` | general |
| Watcher Guru | `https://watcher.guru/feed/` | breaking |
| NewsBTC | `https://www.newsbtc.com/feed/` | general |

### How RSS Parsing Works

The system does **NOT** use an XML parser library. It uses regex-based extraction:

```typescript
// 1. Fetch RSS XML with 10-second timeout
const res = await fetch(feed.url, {
  signal: AbortSignal.timeout(10000),
  headers: {
    "User-Agent": "PagerBot/1.0 (RSS Reader)",
    "Accept": "application/rss+xml, application/xml, text/xml",
  },
});

// 2. Parse <item> blocks with regex
const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

// 3. Extract fields from each <item>
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : "";
}

// 4. Clean CDATA, HTML tags, entities
const title = extractTag(itemXml, "title")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")  // remove CDATA wrapper
  .replace(/<[^>]*>/g, "")                         // remove HTML tags
  .trim();

// 5. Description: truncate to 300 chars
const description = extractTag(itemXml, "description")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 300);
```

**Key details:**
- All 12 feeds are fetched **in parallel** with `Promise.allSettled()` — if one fails, others still work
- Each feed has a **10-second timeout** via `AbortController`
- Failed feeds return empty arrays, not errors
- Results are **sorted by pubDate** (newest first)
- Output format per item:
  ```json
  {
    "title": "Bitcoin Hits $100K",
    "link": "https://coindesk.com/...",
    "pubDate": "Mon, 22 Jul 2026 10:00:00 GMT",
    "description": "Short description...",
    "source": "CoinDesk",
    "sourceIcon": "📰"
  }
  ```

**Response:**
```json
{
  "items": [...],
  "sources": [
    { "name": "CoinDesk", "icon": "📰", "category": "general" },
    ...
  ],
  "total": 40
}
```

---

## Step 2: URL Scraping (Full Article Content)

### File: `src/app/api/ai/scrape/route.ts`

**Endpoint:** `POST /api/ai/scrape`
**Body:** `{ "url": "https://coindesk.com/article/..." }`

Uses **Jina Reader API** (`https://r.jina.ai/`) to convert any webpage into clean markdown.

### Flow:

```
Input URL → Clean URL → Jina fetch → Post-process → Output { title, textContent, siteName, mainImage }
```

### Detailed Steps:

**1. URL Cleaning**
```typescript
let cleanUrl = url.startsWith("http") ? url : "https://" + url;

// Telegram links need embed parameter
if (/t\.me\/[a-zA-Z0-9_]+\/\d+/.test(cleanUrl)) {
  cleanUrl += "?embed=1";
}
```

**2. Jina Reader API Call**
```typescript
const headers = {
  "X-Return-Format": "markdown",     // Return markdown, not HTML
  "X-With-Generated-Alt": "true",    // Generate alt text for images
  "User-Agent": "Mozilla/5.0 ...",
};

// Optional: add Jina API key for higher rate limits
if (process.env.JINA_API_KEY) {
  headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
}

const res = await fetch("https://r.jina.ai/" + cleanUrl, { headers, cache: "no-store" });
let markdown = await res.text();
```

**3. Telegram-specific cleanup**
```typescript
if (cleanUrl.includes("t.me")) {
  markdown = markdown
    .replace(/\[View in Telegram\]\(.*?\)/gi, "")
    .replace(/\[View Context\]\(.*?\)/gi, "")
    .replace(/\[Join Channel\]\(.*?\)/gi, "")
    .replace(/If you have Telegram.*?right away\./gi, "")
    .replace(/!\[.*?\]\(https:\/\/cdn4\.cdn-telegram\.org\/img\/.*?\)/gi, "")
    .trim();
}
```

**4. Global link stripping** (prevents AI from copying URLs into articles)
```typescript
// [link text](url) → link text (keep text, remove URL)
markdown = markdown.replace(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/gi, "$1");
// Bare URLs → remove
markdown = markdown.replace(/https?:\/\/[^\s\)]+/gi, "");
```

**5. Add source context for AI**
```typescript
const siteName = new URL(cleanUrl).hostname;
const textWithSource = `SOURCE: ${siteName}\n\n${markdown}`;
```

**6. Extract title and main image**
```typescript
// Title: first H1 heading
const titleMatch = markdown.match(/^#\s+(.*)/m);
const title = titleMatch ? titleMatch[1] : "Untitled Article";

// Image: first image URL in markdown
const mdImageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
const mainImage = mdImageMatch ? mdImageMatch[1] : null;
```

**Response:**
```json
{
  "title": "Bitcoin Hits $100K",
  "textContent": "SOURCE: coindesk.com\n\nFull article markdown...",
  "siteName": "coindesk.com",
  "mainImage": "https://..."
}
```

**Error handling:**
| Status | Meaning |
|--------|---------|
| 401 | Jina API key required |
| 402 | Jina credits exhausted |
| 429 | Rate limit exceeded |
| 422 | Content too short (<50 chars) |

---

## Step 3: AI Text Rewriting

### File: `src/app/api/ai/text/route.ts`

**Endpoint:** `POST /api/ai/text`
**Body:**
```json
{
  "content": "Full scraped article text",
  "title": "Original title",
  "mood": "sarcastic",
  "nftTokenId": "1",
  "atmosphere": "Surrealism"
}
```

**Model:** `google/gemini-2.5-flash` via OpenRouter

**System prompt** is built from the selected mascot's DNA (personality + voice) and the atmosphere's text instructions.

**User prompt** instructs the AI to rewrite the article in character voice and return strict JSON:
```json
{
  "title": "Rewritten title",
  "body": "HTML article with <strong>, <em> tags",
  "analysis": "2-sentence BTC market insight",
  "banner": "DETAILED visual scene for AI image generation"
}
```

**Response:** The body is formatted (markdown → HTML), then appended with:
- BTC Impact Analysis block (with referral links from profile)
- Mining Hash sponsor block

---

## Step 4: Banner Image Generation

### File: `src/app/api/ai/banner/route.ts`

**Endpoint:** `POST /api/ai/banner`
**Model:** `flux-2-pro` via BFL API

**Flow:**
1. Build visual prompt from mascot DNA + atmosphere + article context
2. Send to BFL API → poll for result (~60-90 seconds)
3. Upload result to Pinata IPFS
4. Return IPFS URL

**The visual prompt** includes:
- Character physical description from DNA
- Reference image URL
- Mood-specific atmosphere (lighting, colors)
- Article context (what to illustrate)
- Art style instructions (Surrealism, Pixel Art, Anime, etc.)

---

## Step 5: Article Creation

### File: `src/app/api/article/create/route.ts`

**Endpoint:** `POST /api/article/create`
**Body:**
```json
{
  "title": "Article title",
  "content": "Full HTML body",
  "image_url": "https://...",
  "author_address": "0x..."
}
```

Inserts into Supabase `articles` table with a UUID. Also returns distribution targets (Telegram channels, Binance accounts) from the author's profile.

---

## Step 6: Distribution

### File: `src/lib/distribution.ts`

**Telegram:** Sends via Bot API (`sendPhoto` with caption, fallback to `sendMessage`)
**Binance Square:** Posts via Binance OpenAPI (`POST /bapi/composite/v1/public/pgc/openApi/content/add`)

Content is adapted per platform (language, style) via AI before posting.

---

## Automation Pipeline

### File: `src/app/api/automation/run/route.ts`

**Endpoint:** `GET|POST /api/automation/run?secret=xxx&force=1`

Combines all steps into one pipeline:

```
RSS fetch → topic filter → dedup (source_url check) → scrape → AI rewrite → banner → create article → distribute
```

**Config (from `automation_config` table):**
```json
{
  "enabled": true,
  "interval_minutes": 60,
  "max_articles_per_run": 1,
  "topics": ["crypto", "bitcoin", "defi"],
  "languages": ["en"],
  "mascot_id": "1",
  "mood": "sarcastic",
  "atmosphere": "Surrealism",
  "profile_address": "0x..."
}
```

**Cooldown:** Won't run again until `interval_minutes` has passed since `last_run_at` (unless `force=1`).

**Deduplication:** Checks `source_url` in `articles` table — skips already-published URLs.

---

## Environment Variables Required

```env
# RSS / Scraping
JINA_API_KEY=jina_...

# AI Text
OPENROUTER_API_KEY=sk-or-...

# AI Banner
BFL_API_KEY=bfl_...

# IPFS
PINATA_JWT=eyJ...

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Telegram
TELEGRAM_BOT_TOKEN=123:ABC...

# Auth
SITE_API_KEY=your_secret_key
CRON_SECRET=your_cron_secret
```

---

## Database Tables

```sql
-- Articles
CREATE TABLE articles (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT,        -- RSS article URL (for dedup)
  author_address TEXT,
  lang TEXT DEFAULT 'en',
  likes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_articles_source_url ON articles(source_url);

-- Automation config
CREATE TABLE automation_config (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT FALSE,
  interval_minutes INT DEFAULT 60,
  topics JSONB DEFAULT '["crypto"]',
  max_articles_per_run INT DEFAULT 1,
  mascot_id TEXT DEFAULT '1',
  mood TEXT DEFAULT 'sarcastic',
  atmosphere TEXT DEFAULT 'Surrealism',
  profile_address TEXT DEFAULT '',
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Run history
CREATE TABLE automation_history (
  id BIGSERIAL PRIMARY KEY,
  config_id INT,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  articles_found INT DEFAULT 0,
  articles_published INT DEFAULT 0,
  error_message TEXT
);
```
