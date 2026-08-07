import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { postToBinance, postToTelegram, adaptContent } from "@/lib/distribution";
import { decryptData } from "@/lib/security";
import { verifySignature, getAuthMessage } from "@/lib/auth";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { articleId, targets, profileAddress, signature, message } = await req.json();

    if (!articleId || !targets || !profileAddress) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const normalizedAddress = profileAddress.toLowerCase();

    // Accept either "authorize session" or "publish article" signature
    // This allows the frontend to reuse the publish signature for distribution
    const sessionMessage = getAuthMessage("authorize session", normalizedAddress);
    const publishMessage = getAuthMessage("publish article", normalizedAddress);
    if (message !== sessionMessage && message !== publishMessage) {
      return NextResponse.json({ error: "Invalid auth message" }, { status: 401 });
    }
    if (!(await verifySignature(message, signature, normalizedAddress))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).single();
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const { data: profile } = await supabase.from("profiles").select("name").eq("address", normalizedAddress).single();
    const aiKey = process.env.OPENROUTER_API_KEY || "";
    const authorName = profile?.name || `${profileAddress.slice(0, 6)}...`;
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://pager.lookhook.info").replace(/\/$/, "");

    const results: { channel: string; success: boolean; error?: string }[] = [];

    for (const target of targets) {
      const { type, account } = target;
      let title = article.title;
      let content = article.content;
      let imageUrl = article.image_url;

      if (account?.language || account?.style) {
        const adapted = await adaptContent(title, content, account.language || "English", account.style || "Professional", aiKey, type);
        title = adapted.title;
        content = adapted.teaser;
      }

      // Fallback OG image for any channel if article has no banner
      if (!imageUrl) {
        imageUrl = `${baseUrl}/api/og?id=${articleId}&title=${encodeURIComponent(title)}`;
      }

      let res: { success: boolean; error?: string };

      if (type === "binance") {
        const secureAccount = { ...account, apiKey: account.apiKey ? decryptData(account.apiKey) : "" };
        res = await postToBinance(secureAccount, title, content, articleId);
      } else if (type === "telegram") {
        const chatId = account.topicId ? `${account.chatId}/${account.topicId}` : account.chatId;
        res = await postToTelegram(chatId, title, content, articleId, imageUrl, authorName);
      } else if (type === "global") {
        const globalChannel = process.env.NEXT_PUBLIC_GLOBAL_TELEGRAM_CHANNEL;
        if (!globalChannel) {
          res = { success: false, error: "Global channel not configured" };
        } else {
          res = await postToTelegram(globalChannel, title, content, articleId, imageUrl, authorName);
        }
      } else {
        res = { success: false, error: "Unknown channel type" };
      }

      results.push({ channel: account?.label || type, success: res.success, error: res.error });
    }

    const allOk = results.every(r => r.success);
    return NextResponse.json({ success: allOk, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
