import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FeedSource {
  name: string;
  url: string;
  icon: string;
  category: string;
}

const FEEDS: FeedSource[] = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", icon: "📰", category: "general" },
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss", icon: "⚡", category: "general" },
  { name: "crypto.news", url: "https://crypto.news/feed/", icon: "🪙", category: "general" },
  { name: "Bitcoin.com News", url: "https://news.bitcoin.com/feed/", icon: "₿", category: "general" },
  { name: "NewsBTC", url: "https://www.newsbtc.com/feed/", icon: "💰", category: "general" },
  { name: "Decrypt", url: "https://decrypt.co/feed", icon: "🔐", category: "web3" },
  { name: "Watcher Guru", url: "https://watcher.guru/feed/", icon: "👁", category: "breaking" },
  { name: "U.Today", url: "https://u.today/rss", icon: "📋", category: "breaking" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed", icon: "₿", category: "bitcoin" },
  { name: "Bitcoinist", url: "https://bitcoinist.com/feed/", icon: "₿", category: "bitcoin" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml", icon: "🔍", category: "research" },
  { name: "CryptoPotato", url: "https://cryptopotato.com/feed/", icon: "📈", category: "analysis" },
  { name: "AMBCrypto", url: "https://ambcrypto.com/feed/", icon: "🧠", category: "analysis" },
  { name: "BeInCrypto", url: "https://beincrypto.com/feed/", icon: "📊", category: "analysis" },
  { name: "CoinPedia", url: "https://coinpedia.org/feed/", icon: "🪙", category: "analysis" },
  { name: "Unchained", url: "https://unchainedcrypto.com/feed/", icon: "🔗", category: "defi" },
  { name: "The Defiant", url: "https://thedefiant.io/feed", icon: "🦇", category: "defi" },
  { name: "Cryptonews", url: "https://cryptonews.com/news/feed/", icon: "📜", category: "regulation" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", icon: "🌍", category: "geopolitics" },
  { name: "DW News", url: "https://rss.dw.com/rdf/rss-en-all", icon: "🌐", category: "geopolitics" },
  { name: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", icon: "📊", category: "economy" },
  { name: "Investing.com", url: "https://www.investing.com/rss/news.rss", icon: "💹", category: "economy" },
  { name: "FT Markets", url: "https://www.ft.com/markets?format=rss", icon: "🏦", category: "economy" },
  { name: "CNBC Economy", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", icon: "🇺🇸", category: "economy" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", icon: "🤖", category: "tech" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", icon: "🔬", category: "tech" },
];

const DEFAULT_MAX_AGE_HOURS = 24;

interface ParsedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  sourceIcon: string;
  category: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
}

function cleanCdata(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function limitDescription(text: string): string {
  return text.slice(0, 300);
}

function parseDate(value: string): number {
  if (!value) return Date.now();
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

function parseRss2Items(xml: string, source: FeedSource): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = cleanCdata(extractTag(itemXml, "title"));
    const link = cleanCdata(extractTag(itemXml, "link"));
    const pubDate = parseDate(cleanCdata(extractTag(itemXml, "pubDate")));
    const description = limitDescription(cleanCdata(extractTag(itemXml, "description")));

    if (title && link) {
      items.push({
        title,
        link,
        pubDate: new Date(pubDate).toISOString(),
        description,
        source: source.name,
        sourceIcon: source.icon,
        category: source.category,
      });
    }
  }

  return items;
}

function parseAtomItems(xml: string, source: FeedSource): ParsedItem[] {
  const items: ParsedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    const title = cleanCdata(extractTag(entryXml, "title"));
    const link =
      extractAttr(entryXml, "link", "href") || cleanCdata(extractTag(entryXml, "link"));
    const pubDate = parseDate(
      cleanCdata(extractTag(entryXml, "published") || extractTag(entryXml, "updated"))
    );
    const description = limitDescription(
      cleanCdata(extractTag(entryXml, "summary") || extractTag(entryXml, "content"))
    );

    if (title && link) {
      items.push({
        title,
        link,
        pubDate: new Date(pubDate).toISOString(),
        description,
        source: source.name,
        sourceIcon: source.icon,
        category: source.category,
      });
    }
  }

  return items;
}

function parseRdfItems(xml: string, source: FeedSource): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemRegex = /<item rdf:about="([^"]*)">([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const link = match[1];
    const itemXml = match[2];
    const title = cleanCdata(extractTag(itemXml, "title"));
    const pubDate = parseDate(cleanCdata(extractTag(itemXml, "dc:date")));
    const description = limitDescription(cleanCdata(extractTag(itemXml, "description")));

    if (title && link) {
      items.push({
        title,
        link,
        pubDate: new Date(pubDate).toISOString(),
        description,
        source: source.name,
        sourceIcon: source.icon,
        category: source.category,
      });
    }
  }

  return items;
}

function parseFeed(xml: string, source: FeedSource): ParsedItem[] {
  const rss2 = parseRss2Items(xml, source);
  if (rss2.length) return rss2;

  const atom = parseAtomItems(xml, source);
  if (atom.length) return atom;

  const rdf = parseRdfItems(xml, source);
  if (rdf.length) return rdf;

  return [];
}

async function fetchFeed(source: FeedSource): Promise<ParsedItem[]> {
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PagerBot/1.0)",
        Accept: "application/xml, application/rss+xml, application/atom+xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      console.warn(`[NEWS] ${source.name}: HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();
    const isXml = text.trim().startsWith("<?xml") || text.trim().startsWith("<rss") || text.trim().startsWith("<feed") || text.trim().startsWith("<rdf");
    if (!isXml) {
      console.warn(`[NEWS] ${source.name}: Non-XML response`);
      return [];
    }

    const items = parseFeed(text, source);
    console.log(`[NEWS] ${source.name}: ${items.length} items`);
    return items;
  } catch (e: any) {
    console.warn(`[NEWS] ${source.name}: Timeout or error`);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceFilter = searchParams.get("source") || "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 120);
const maxAgeHours = Math.min(
    Number(searchParams.get("maxAge")) || DEFAULT_MAX_AGE_HOURS,
    DEFAULT_MAX_AGE_HOURS
  );
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  const feedsToFetch =
    sourceFilter === "all"
      ? FEEDS
      : FEEDS.filter((f) => f.name.toLowerCase() === sourceFilter.toLowerCase());

  console.log(`[NEWS] Fetching ${feedsToFetch.length} feeds`);

  const results = await Promise.allSettled(feedsToFetch.map(fetchFeed));

  const fulfilled = results
    .filter((r): r is PromiseFulfilledResult<ParsedItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const allItems = fulfilled
    .filter((item) => {
      const t = item.pubDate ? new Date(item.pubDate).getTime() : 0;
      return t >= cutoff;
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, limit);

  const sources = FEEDS.map((f) => ({
    name: f.name,
    icon: f.icon,
    category: f.category,
  }));

  return NextResponse.json({ items: allItems, sources, total: allItems.length });
}