import { NextResponse } from 'next/server';
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock } from '@/lib/character';

// Vercel Serverless Config
export const maxDuration = 30; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let requestUrl = '';
  console.log("--- 🤖 [AI Process] Step-by-Step Mode ---");
  try {
    const body = await req.json();
    const { mood = "neutral", userApiKey, content: providedContent, title: providedTitle } = body;

    // Приоритет: 1. Ключ пользователя 2. Системный ключ
    const apiKey = userApiKey || process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
    
    if (!apiKey) {
      console.error("❌ [AI Process] No API Key found");
      return NextResponse.json({ error: 'No API Key provided. Please set it in your profile.' }, { status: 400 });
    }

    if (!providedContent) {
      console.error("❌ [AI Process] No content provided");
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // 2. AI Rewrite
    const model = process.env.AI_MODEL || 'google/gemini-2.0-flash-001';
    console.log("🚀 [AI Process] Requesting AI Rewrite (Model:", model, ")...");
    
    const systemPrompt = getCharacterSystemPrompt(mood);
    const userPrompt = `
      Rewrite the following article in Cyber-Ghoul style.
      Style guidelines: ${mood} tone. 
      Original Title: ${providedTitle || 'Untitled'}
      Original Content: ${providedContent}
      
      Requirements:
      1. Create a punchy, unique title.
      2. Rewrite the content to be engaging, witty, and Web3-focused. Use Markdown.
      3. Add a short BTC market analysis at the end based on the news.
      
      Return ONLY JSON format:
      {
        "rewrittenTitle": "...",
        "rewrittenContent": "...",
        "btcAnalysis": "...",
        "bannerSceneDescription": "..."
      }
    `;

    // Используем нативный fetch для стабильности
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pager.lookhook.info',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `AI error: ${aiResponse.status}`;
      console.error("❌ [AI Process] OpenRouter Error:", errorMsg);
      return NextResponse.json({ error: errorMsg }, { status: aiResponse.status });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error("Empty AI response from OpenRouter");
    }

    // Парсим результат
    let result;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : aiContent);
    } catch (e) {
      console.error("❌ [AI Process] JSON Parse Error. Raw content:", aiContent);
      throw new Error("AI returned invalid JSON format");
    }

    // 4. Assembly
    const finalContent = `${result.rewrittenContent}
    
${getBtcAnalysisBlock(result.btcAnalysis)}

${getMiningSponsorBlock()}`;

    // 5. Image Generation
    const bannerPrompt = encodeURIComponent(`GTA style illustration of Cyber-Ghoul: ${result.bannerSceneDescription}, vibrant neon lighting, high contrast, 16:9`);
    const generatedBannerUrl = `https://image.pollinations.ai/prompt/${bannerPrompt}?width=1280&height=720&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    console.log("✅ [AI Process] Success!");
    return NextResponse.json({
      title: result.rewrittenTitle,
      content: finalContent,
      image_url: generatedBannerUrl
    });

  } catch (error: any) {
    console.error("❌ [API AI Process Error]:", error.message);
    return NextResponse.json({ 
      error: error.message,
      type: error.name
    }, { status: 500 });
  }
}
