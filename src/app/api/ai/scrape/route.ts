import { NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    console.log("📡 [Cyber-Scraper] Using Jina AI for:", url);
    
    // Используем Jina Reader API - это лучший способ получить контент для AI
    const jinaUrl = `https://r.jina.ai/${url}`;
    
    const res = await fetch(jinaUrl, {
      headers: { 
        'X-Return-Format': 'markdown',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ [Jina Error]:", errorText);
      return NextResponse.json({ 
        error: `Jina Reader failed: ${res.status}`,
        details: errorText.slice(0, 100)
      }, { status: 200 });
    }

    const markdown = await res.text();
    
    // Пытаемся вытащить заголовок из первой строки маркдауна (обычно это # Title)
    const titleMatch = markdown.match(/^#\s+(.*)/);
    const title = titleMatch ? titleMatch[1] : "Untitled Article";

    return NextResponse.json({
      title: title,
      textContent: markdown,
      siteName: new URL(url).hostname
    });

  } catch (error: any) {
    console.error("❌ [Scrape API] Critical Error:", error.message);
    return NextResponse.json({ 
      error: "Scraper crashed", 
      details: error.message 
    }, { status: 200 });
  }
}
