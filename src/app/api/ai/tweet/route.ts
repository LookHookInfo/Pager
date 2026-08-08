import { NextResponse } from "next/server";
import { chatAnyModel } from "@/lib/anymodel";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { title, content, articleUrl } = await req.json();

    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

    const cleanContent = (content || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    const raw = await chatAnyModel({
      messages: [
        {
          role: "system",
          content: `You are a viral Web3 social media copywriter. You write tweets that get engagement — provocative, punchy, clickbait-worthy but factual.

IMPORTANT: You generate ONLY the hook and hashtags. The link will be added automatically by the system. DO NOT include any URL or "Continue reading" in your output.

OUTPUT FORMAT (STRICT JSON):
{ "hook": "provocative hook sentence with @mentions", "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5" }

RULES:
1. "hook": ONE provocative, curiosity-driven sentence. Max 120 chars. Make people want to click.
2. "hook" MUST include 1-2 @mentions of projects, people, or platforms from the article (e.g. @NEARProtocol, @VitalikButerin, @coinbase). Extract them from the article content.
3. "hashtags": EXACTLY 5 hashtags separated by spaces — mix specific project tags (#BitcoinETF, #SolanaDeFi) with broader ones (#Crypto, #Web3, #DeFi).
4. NO emojis. NO "thread". NO "gm" or "wagmi".
5. Sound like a smart degen, not a corporate account.
6. Output ONLY valid JSON. Nothing else.`
        },
        {
          role: "user",
          content: `Generate a viral tweet hook and hashtags for this article:\n\nTITLE: ${title}\n\nCONTENT: ${cleanContent}`
        }
      ],
      temperature: 0.9,
      maxTokens: 300,
      timeoutMs: 40000,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : {};

    let hook = (result.hook || title).trim();
    let hashtags = (result.hashtags || "#Crypto #Web3 #DeFi #Base #Blockchain").trim();

    // Ensure exactly 5 hashtags
    const tags = hashtags.split(/\s+/).filter((t: string) => t.startsWith("#"));
    while (tags.length < 5) {
      const defaults = ["#Crypto", "#Web3", "#DeFi", "#Base", "#Blockchain"];
      const missing = defaults.find(d => !tags.includes(d));
      if (missing) tags.push(missing);
      else break;
    }
    hashtags = tags.slice(0, 5).join(" ");

    // Build the link line
    const fullUrl = articleUrl || "https://pager.lookhook.info";
    const linkLine = `\n\nContinue reading: ${fullUrl}`;

    // Budget: 280 total - link line length - 2 newlines
    const linkBudget = 280 - linkLine.length;
    // hook + space + hashtags must fit in linkBudget
    const hashtagsLine = "\n\n" + hashtags;
    const hookBudget = linkBudget - hashtagsLine.length;

    // Trim hook if needed
    if (hook.length > hookBudget) {
      hook = hook.slice(0, hookBudget - 3).trimEnd() + "...";
    }

    const tweet = hook + hashtagsLine + linkLine;

    return NextResponse.json({ tweet });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
