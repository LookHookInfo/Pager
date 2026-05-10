import { NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    // Очистка URL от лишних пробелов
    const targetUrl = url.trim();
    console.log("📡 [Scraper] Processing URL:", targetUrl);
    
    // Используем Jina Reader API
    // Добавляем префикс https:// если его нет (на всякий случай)
    const cleanUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
    
    console.log("📡 [Scraper] Calling Jina:", jinaUrl);

    const res = await fetch(jinaUrl, {
      headers: { 
        'X-Return-Format': 'markdown',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      // Увеличиваем таймаут и отключаем кэширование для свежих данных
      cache: 'no-store'
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ [Jina Error ${res.status}]:`, errorText);
      
      // Если Jina упала с 400, это часто значит, что сайт блокирует ботов или URL кривой
      return NextResponse.json({ 
        error: `Jina Reader failed: ${res.status}`,
        details: res.status === 400 ? "The website might be blocking scrapers or the URL is protected. Try another link." : errorText.slice(0, 100)
      }, { status: 200 });
    }

    const markdown = await res.text();
    
    if (!markdown || markdown.length < 50) {
      return NextResponse.json({ 
        error: "Article content too short",
        details: "Jina couldn't extract meaningful text from this page."
      }, { status: 200 });
    }
    
    // Пытаемся вытащить заголовок
    const titleMatch = markdown.match(/^#\s+(.*)/);
    const title = titleMatch ? titleMatch[1] : "Untitled Article";

    console.log("✅ [Scraper] Success! Title:", title);

    return NextResponse.json({
      title: title,
      textContent: markdown,
      siteName: new URL(cleanUrl).hostname
    });

  } catch (error: any) {
    console.error("❌ [Scrape API] Critical Error:", error.message);
    return NextResponse.json({ 
      error: "Scraper crashed", 
      details: error.message 
    }, { status: 200 });
  }
}
