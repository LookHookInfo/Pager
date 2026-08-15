import { NextResponse } from "next/server";
import { chatAnyModel } from "@/lib/anymodel";
import { cleanHashtag, detectCommunities } from "@/lib/tweet-entities";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const FALLBACK_FILLERS = ["#Crypto", "#Web3", "#DeFi", "#Base", "#Blockchain"];

export async function POST(req: Request) {
  try {
    const { title, content, articleUrl } = await req.json();

    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

    const cleanContent = (content || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    const searchText = `${title}\n${cleanContent}`;
    const communities = detectCommunities(searchText);
    const mentionPool = communities.map(c => c.handle.toLowerCase());
    const tagPool = communities.map(c => c.tag.toLowerCase());
    const mainTag = communities[0]?.tag ?? null;

    const communityContext = communities.length
      ? communities.map(c => `- ${c.name} → ${c.handle} (hashtag #${c.tag})`).join("\n")
      : "(none detected — @mention a project/person only if its official handle is clearly identifiable from the article, otherwise omit mentions)";

    const mainSubject = mainTag
      ? `#${mainTag} (${communities[0].name})`
      : "the single most important subject of this article (the main token, protocol, project or event)";

    const raw = await chatAnyModel({
      messages: [
        {
          role: "system",
          content: `You are a viral Web3 social media copywriter. You write tweets that get engagement — provocative, punchy, clickbait-worthy but factual.

IMPORTANT: You generate ONLY the hook and hashtags. The link will be added automatically by the system. DO NOT include any URL or "Continue reading" in your output.

OUTPUT FORMAT (STRICT JSON):
{ "hook": "provocative hook sentence with @mentions", "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5" }

CONTEXT — THIS ARTICLE:
TITLE: ${title}
RELEVANT COMMUNITIES DETECTED IN THE ARTICLE (use ONLY these for @mentions):
${communityContext}
MAIN SUBJECT TAG: ${mainSubject} — this tag MUST be the FIRST hashtag.

RULES:
1. "hook": ONE provocative, curiosity-driven sentence. Max 110 chars. It MUST reference the article's actual subject.
2. "hook" MUST include 1-2 @mentions chosen ONLY from RELEVANT COMMUNITIES. NEVER invent or guess handles. If none were detected, only mention a project/person whose official handle is clearly present in the article.
3. "hashtags": EXACTLY 5 hashtags, space-separated, ALL ON-TOPIC:
   - FIRST: the MAIN SUBJECT TAG.
   - then: specific tags from THIS article (project names, tickers, events — e.g. #BitcoinETF, #L2, #DeFi).
   - last: at most 1 broader filler (#Crypto / #Web3 / #DeFi / #Base).
   Every hashtag must relate to THIS article. Never use random or unrelated tags.
4. NO emojis. NO "thread". NO "gm" or "wagmi".
5. Sound like a smart degen, not a corporate account.
6. Output ONLY valid JSON. Nothing else.`,
        },
        {
          role: "user",
          content: `Generate a viral tweet hook and hashtags for this article:\n\nTITLE: ${title}\n\nCONTENT: ${cleanContent}`,
        },
      ],
      temperature: 0.9,
      maxTokens: 1200,
      timeoutMs: 40000,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : {};

    let hook = String(result.hook || title).trim();
    let hashtags = String(result.hashtags || "").trim();

    // ---- 1) Hashtags: force on-topic, main subject first, exactly 5 ----
    let tags = hashtags
      .split(/\s*,\s*|\s+/)
      .map(cleanHashtag)
      .filter(t => t.length > 1 && t.startsWith("#"));

    if (mainTag && !tags.some(t => t.toLowerCase() === `#${mainTag.toLowerCase()}`)) {
      tags.unshift(`#${mainTag}`);
    }

    const isOnTopic = (t: string) => {
      const body = t.toLowerCase().slice(1);
      return tagPool.includes(body) || tagPool.some(x => body.includes(x));
    };
    tags = [...tags.filter(isOnTopic), ...tags.filter(t => !isOnTopic(t))];

    const seen = new Set<string>();
    const finalTags: string[] = [];
    for (const t of tags) {
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      finalTags.push(t);
      if (finalTags.length >= 5) break;
    }
    for (const f of FALLBACK_FILLERS) {
      if (finalTags.length >= 5) break;
      const key = f.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        finalTags.push(f);
      }
    }
    for (let i = 1; finalTags.length < 5; i++) finalTags.push(`#Web3${i}`);
    hashtags = finalTags.slice(0, 5).join(" ");

    // ---- 2) Hook: guarantee at least one relevant community @mention ----
    const fullUrl = articleUrl || "https://pager.lookhook.info";
    const linkLine = `\n\nContinue reading: ${fullUrl}`;
    const hashtagsLine = "\n\n" + hashtags;
    const hookBudget = 280 - linkLine.length - hashtagsLine.length;

    if (mentionPool.length > 0 && !mentionPool.some(h => hook.toLowerCase().includes(h))) {
      const handle = communities[0].handle;
      const reserve = handle.length + 1;
      if (hook.length > hookBudget - reserve) {
        hook = hook.slice(0, hookBudget - reserve - 3).trimEnd() + "...";
      }
      hook = `${hook} ${handle}`;
    }

    if (hook.length > hookBudget) {
      hook = hook.slice(0, hookBudget - 3).trimEnd() + "...";
    }

    const tweet = hook + hashtagsLine + linkLine;

    return NextResponse.json({ tweet });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
