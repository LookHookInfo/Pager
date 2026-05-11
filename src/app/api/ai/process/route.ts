import { NextResponse } from 'next/server';
import { getCharacterSystemPrompt, getBtcAnalysisBlock, getMiningSponsorBlock, getCharacterVisualPrompt } from '@/lib/character';

export const maxDuration = 30; 
export const dynamic = 'force-dynamic';

/**
 * Финальная очистка и превращение остатков Markdown в чистый HTML.
 */
function finalFormat(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mood = "neutral", character = "ghoul", userApiKey, content: providedContent, title: providedTitle } = body;

    // СТРОГИЙ МИНИМАЛИЗМ: Только по ключу пользователя
    if (!userApiKey) {
      return NextResponse.json({ error: 'OpenRouter API Key required in profile.' }, { status: 403 });
    }

    const textModel = 'google/gemini-2.0-flash-001';
    const imageModel = 'google/gemini-3.1-flash-image-preview';
    const systemPrompt = getCharacterSystemPrompt(mood, character as any);
    const charName = character === 'nana' ? 'Nana Banana' : 'Cyber-Ghoul';

    const userPrompt = `
      ACT AS A PROFESSIONAL WEB3 EDITOR. 
      Rewrite the article below in ${charName} style.
      
      CRITICAL RULES:
      1. TITLE: Explosive, provocative, under 50 chars. NO QUOTES.
      2. CONTENT: Professional HTML only. 
         - Wrap every paragraph in <p style="margin-bottom: 24px; line-height: 1.6;">.
         - Use <strong> for tickers ($BTC, $HASH) and key concepts.
         - 3-4 paragraphs max. 
      3. BTC ANALYSIS: 2-3 sentences of expert market view.
      4. BANNER: Describe a cinematic scene with ${charName}.
      
      JSON OUTPUT FORMAT:
      {
        "title": "...",
        "body": "...",
        "analysis": "...",
        "banner": "..."
      }
      
      ARTICLE TO REWRITE:
      ${providedContent}
    `;

    // 1. GENERATE TEXT
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pager.lookhook.info',
      },
      body: JSON.stringify({
        model: textModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.json().catch(() => ({}));
      throw new Error(err.error?.message || "OpenRouter API Error");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    if (!aiContent) throw new Error("AI returned empty content");

    let result;
    try {
      result = JSON.parse(aiContent);
    } catch (e) {
      const match = aiContent.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON Parse Error");
      result = JSON.parse(match[0]);
    }

    const finalTitle = (result.title || providedTitle || "New Intel").replace(/["']/g, '').trim();
    let finalBody = finalFormat(result.body || "");
    if (!finalBody.includes('<p')) {
      finalBody = finalBody.split('\n\n').map(p => `<p style="margin-bottom: 24px;">${p}</p>`).join('');
    }

    const fullHtml = `
      ${finalBody}
      ${getBtcAnalysisBlock(finalFormat(result.analysis || "Market sentiment is shifting."), character as any)}
      ${getMiningSponsorBlock()}
    `;

    // 2. GENERATE BANNER (STRICT GEMINI 3.1)
    const visualPrompt = getCharacterVisualPrompt(result.banner || finalTitle, mood, character as any, finalTitle);
    let bannerUrl = "";
    
    try {
      console.log(`🚀 [Minimalist-AI] Generating image with: ${imageModel}`);
      
      const imgAiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pager.lookhook.info',
        },
        body: JSON.stringify({
          model: imageModel,
          modalities: ["image", "text"],
          messages: [
            { 
              role: 'user', 
              content: [{ type: "text", text: visualPrompt }] 
            }
          ]
        })
      });

      if (imgAiResponse.ok) {
        const imgData = await imgAiResponse.json();
        const choice = imgData.choices?.[0];
        bannerUrl = choice?.message?.images?.[0]?.image_url?.url || "";
      } else {
        const errData = await imgAiResponse.json().catch(() => ({}));
        console.error("❌ [Minimalist-AI] Image Error:", errData.error?.message);
      }
    } catch (err: any) {
      console.error("❌ [Minimalist-AI] Critical Error:", err.message);
    }

    return NextResponse.json({
      title: finalTitle,
      content: fullHtml,
      image_url: bannerUrl
    });

  } catch (error: any) {
    console.error("❌ [AI API ERROR]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
