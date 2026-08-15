import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface FeedSource {
  name: string;
  url: string;
  icon: string;
  category: string;
}

const FEEDS: FeedSource[] = [
  // ── Crypto Core ──
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", icon: "📰", category: "general" },
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss", icon: "⚡", category: "general" },
  { name: "CryptoSlate", url: "https://cryptoslate.com/feed/", icon: "🖥", category: "general" },
  { name: "NewsBTC", url: "https://www.newsbtc.com/feed/", icon: "💰", category: "general" },
  { name: "Decrypt", url: "https://decrypt.co/feed", icon: "🔐", category: "web3" },
  { name: "Watcher Guru", url: "https://watcher.guru/feed/", icon: "👁", category: "breaking" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed", icon: "₿", category: "bitcoin" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml", icon: "🔍", category: "research" },
  { name: "DL News", url: "https://www.dlnews.com/rss/", icon: "📊", category: "research" },
  { name: "BeInCrypto", url: "https://beincrypto.com/feed/", icon: "📈", category: "analysis" },
  { name: "Unchained", url: "https://unchainedcrypto.com/feed/", icon: "🔗", category: "defi" },
  { name: "The Defiant", url: "https://thedefiant.io/feed", icon: "🦇", category: "defi" },
  { name: "CoinPedia", url: "https://coinpedia.org/feed/", icon: "🪙", category: "analysis" },
  { name: "U.Today", url: "https://u.today/rss", icon: "📋", category: "breaking" },

  // ── Regulation & Policy ──
  { name: "Cryptonews", url: "https://cryptonews.com/news/feed/", icon: "📜", category: "regulation" },
  { name: "Cointelegraph Policy", url: "https://cointelegraph.com/tags/regulation/rss", icon: "⚖", category: "regulation" },

  // ── Geopolitics & Global Affairs ──
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", icon: "🌍", category: "geopolitics" },
  { name: "DW News", url: "https://rss.dw.com/rdf/rss-en-all", icon: "🌐", category: "geopolitics" },
  { name: "Reuters World", url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best", icon: "🏛", category: "geopolitics" },

  // ── Economy & Markets ──
  { name: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", icon: "📊", category: "economy" },
  { name: "Investing.com", url: "https://www.investing.com/rss/news.rss", icon: "💹", category: "economy" },
  { name: "FT Markets", url: "https://www.ft.com/markets?format=rss", icon: "🏦", category: "economy" },
  { name: "CNBC Economy", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", icon: "🇺🇸", category: "economy" },

  // ── AI & Tech ──
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", icon: "🤖", category: "tech" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", icon: "🔬", category: "tech" },
];

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : "";
}

function cleanCdata(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml: string, source: FeedSource) {
  const items: {
    title: string;
    link: string;
    pubDate: string;
    description: string;
    source: string;
    sourceIcon: string;
    category: string;
  }[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = cleanCdata(extractTag(itemXml, "title"));
    const link = cleanCdata(extractTag(itemXml, "link"));
    const pubDate = cleanCdata(extractTag(itemXml, "pubDate"));
    const description = cleanCdata(extractTag(itemXml, "description")).slice(0, 300);

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        description,
        source: source.name,
        sourceIcon: source.icon,
        category: source.category,
      });
    }
  }

  return items;
}

async function fetchFeed(source: FeedSource) {
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "PagerBot/1.0 (RSS Reader)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!res.ok) return [];

    const xml = await res.text();
    return parseRssItems(xml, source);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceFilter = searchParams.get("source") || "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 120);

  const feedsToFetch =
    sourceFilter === "all"
      ? FEEDS
      : FEEDS.filter((f) => f.name.toLowerCase() === sourceFilter.toLowerCase());

  const results = await Promise.allSettled(feedsToFetch.map(fetchFeed));

  const allItems = results
    .filter((r): r is PromiseFulfilledResult<typeof parseRssItems extends (...args: any) => infer R ? R : never> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, limit);

  const sources = FEEDS.map((f) => ({
    name: f.name,
    icon: f.icon,
    category: f.category,
  }));

  return NextResponse.json({ items: allItems, sources, total: allItems.length });
}
