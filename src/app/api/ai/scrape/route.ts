import { NextResponse } from "next/server";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = body;
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    const targetUrl: string = url.trim();
    let cleanUrl: string = targetUrl.startsWith("http") ? targetUrl : "https://" + targetUrl;

    // URL validation: block internal/private IPs (SSRF protection)
    try {
      const parsed = new URL(cleanUrl);
      const hostname = parsed.hostname.toLowerCase();

      // Block localhost, internal IPs, cloud metadata
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "[::1]" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.") ||
        hostname === "169.254.169.254" ||
        hostname.endsWith(".internal") ||
        hostname.endsWith(".local")
      ) {
        return NextResponse.json({ error: "Internal/private URLs are not allowed" }, { status: 403 });
      }

      // Only allow http/https
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "Only HTTP/HTTPS URLs are allowed" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // --- TELEGRAM OPTIMIZATION ---
    // Исправленная регулярка: [a-zA-Z0-9_]
    const isTelegramMessage = /t\.me\/[a-zA-Z0-9_]+\/\d+/.test(cleanUrl);
    if (isTelegramMessage && !cleanUrl.includes("?embed=")) {
      cleanUrl += (cleanUrl.includes("?") ? "&" : "?") + "embed=1";
    }

    const jinaUrl: string = "https://r.jina.ai/" + cleanUrl;
    
    console.log("📡 [Scraper] Calling Jina:", jinaUrl);

    const headers: Record<string, string> = { 
      "X-Return-Format": "markdown",
      "X-With-Generated-Alt": "true",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const res = await fetch(jinaUrl, {
      headers,
      cache: "no-store"
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ [Scraper] Jina error:", res.status, errorText);
      
      let errorMessage = "Jina failed to read the page";
      if (res.status === 401) errorMessage = "Jina API Key required or invalid for this URL";
      if (res.status === 402) errorMessage = "Jina credits exhausted";
      if (res.status === 429) errorMessage = "Jina rate limit exceeded";

      return NextResponse.json({ 
        error: errorMessage, 
        details: errorText.slice(0, 200),
        status: res.status 
      }, { status: res.status });
    }

    let markdown = await res.text();
    
    // --- TELEGRAM CLEANUP ---
    if (cleanUrl.includes("t.me")) {
      markdown = markdown
        .replace(/\[View in Telegram\]\(.*?\)/gi, "")
        .replace(/\[View Context\]\(.*?\)/gi, "")
        .replace(/\[Join Channel\]\(.*?\)/gi, "")
        .replace(/If you have Telegram, you can view and join.*?right away\./gi, "")
        .replace(/!\[.*?\]\(https:\/\/cdn4\.cdn-telegram\.org\/img\/.*?\)/gi, "") // Remove TG channel avatars
        .trim();
    }

    // --- GLOBAL LINK STRIPPING ---
    // Удаляем все ссылки из текста, чтобы ИИ не вставлял их в статью.
    // Оставляем только текст внутри [текст](ссылка) -> текст
    markdown = markdown.replace(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/gi, "$1");
    // Удаляем голые ссылки
    markdown = markdown.replace(/https?:\/\/[^\s\)]+/gi, "");

    const siteName = new URL(cleanUrl).hostname;
    // Добавляем контекст источника для ИИ в начало текста
    const textWithSource = `SOURCE: ${siteName}\n\n${markdown}`;

    if (!markdown || markdown.length < 50) {
      return NextResponse.json({ error: "Content extraction failed (too short)" }, { status: 422 });
    }
    
    const titleMatch = markdown.match(/^#\s+(.*)/);
    const title = titleMatch ? titleMatch[1] : "Untitled Article";

    let mainImage = null;
    const mdImageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^\s\)]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|assets\.cointelegraph\.com)[^\s\)]*)\)/i);
    
    if (mdImageMatch) {
      mainImage = mdImageMatch[1];
    } else {
      const anyImageMatch = markdown.match(/(https?:\/\/[^\s\)]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|assets\.cointelegraph\.com)[^\s\)]*)/i);
      mainImage = anyImageMatch ? anyImageMatch[1] : null;
    }

    console.log("✅ [Scraper] Success! Title:", title, "Image:", mainImage ? "Found" : "Not Found");

    return NextResponse.json({
      title: title,
      textContent: textWithSource,
      siteName: siteName,
      mainImage: mainImage
    });

  } catch (error: any) {
    console.error("❌ [Scraper] Internal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
