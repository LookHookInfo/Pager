import { normalizeIpfs } from "@/lib/ipfs";
import { getSiteUrl, shortAddress } from "@/lib/site";

export interface MascotNotifyData {
  tokenId: number | string;
  name: string;
  personality: string;
  price: string | number;
  creator: string;
  imageUrl?: string;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** DB `price` хранится как целое число ($HASH); старые строки могут содержать wei. */
function formatPrice(raw: string | number): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "?";
  return n >= 1e18 ? String(Math.floor(n / 1e18)) : String(n);
}

export function formatMascotMessage(d: MascotNotifyData): string {
  const site = getSiteUrl();
  const name = escapeHtml(d.name || `Protocol #${d.tokenId}`).toUpperCase();
  let desc = (d.personality || "").replace(/\s+/g, " ").trim();
  if (desc.length > 200) desc = desc.slice(0, 197).trimEnd() + "...";

  const lines = [
    "⚡ NEW MASCOT · PAGER",
    "",
    `<b>${name}</b> · Mascot 🐣 #${d.tokenId}`,
    `💵 Price: <b>${formatPrice(d.price)} $HASH</b>`,
  ];
  if (desc) lines.push(`🧬 ${escapeHtml(desc)}`);
  lines.push("");
  lines.push(`👤 Creator: ${shortAddress(d.creator)}`);
  lines.push(`🔗 <a href="${site}/mascots">Open Market</a>`);
  return lines.join("\n");
}

/**
 * Постит уведомление о новом маскоте в TG-форум (тема "Pager").
 * Сначала sendPhoto с картинкой маскота, при неудаче — sendMessage.
 */
export async function sendMascotToForum(data: MascotNotifyData): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TG_MASCOT_BOT_TOKEN;
  const chatId = process.env.TG_MASCOT_CHAT_ID;
  if (!token || !chatId) return { success: false, error: "TG forum not configured" };

  const message = formatMascotMessage(data);
  const messageThreadId = process.env.TG_MASCOT_TOPIC_ID ? parseInt(process.env.TG_MASCOT_TOPIC_ID, 10) : undefined;
  const image = normalizeIpfs(data.imageUrl || "");

  if (image) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: image,
          caption: message,
          parse_mode: "HTML",
          message_thread_id: messageThreadId,
        }),
      });
      const d = await res.json();
      if (d.ok) return { success: true };
      console.warn("⚠️ [TG Mascot] sendPhoto failed, falling back to text:", d.description);
    } catch (e: any) {
      console.warn("⚠️ [TG Mascot] sendPhoto error, falling back to text:", e.message);
    }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        message_thread_id: messageThreadId,
        disable_web_page_preview: false,
      }),
    });
    const d = await res.json();
    return d.ok ? { success: true } : { success: false, error: d.description };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
