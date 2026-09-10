import { getSupabaseServer } from '@/lib/supabase';
import { ipfsGatewayVariants } from '@/lib/ipfs';
import sharp from 'sharp';

export const maxDuration = 60;

const WIDTH = 1200;
const HEIGHT = 630;
const FETCH_TIMEOUT_MS = 4000;

const FOOTER_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="140" viewBox="0 0 ${WIDTH} 140">
    <defs>
      <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.85)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.7)"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="5" fill="#ffffff"/>
    <rect y="5" width="${WIDTH}" height="135" fill="url(#bar)"/>
    <text x="${WIDTH - 80}" y="84" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="end">PAGER MEDIA</text>
  </svg>`,
);

/**
 * Брендированная fallback-карточка (градиент + название поста + подвал PAGER MEDIA).
 * Рендерится вместо ЧЁРНОГО баннера, когда картинка поста ещё не доступна
 * (свежий CID не разложился по гейтвеям, гейтвей отдал мусор или у поста нет
 * баннера). Построена на чистом SVG — не может упасть, в отличие от кадрирования
 * бинарной картинки.
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  const capped = lines.slice(0, 4);
  if (lines.length > 4) capped[3] = capped[3].slice(0, Math.max(1, maxChars - 3)) + "...";
  return capped.length ? capped : ["PAGER"];
}

function buildFallbackSvg(rawTitle: string): string {
  const clean =
    (rawTitle || "PAGER")
      .replace(/<[^>]*>/g, "")
      .replace(/&(nbsp|amp|quot|#39);/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) || "PAGER";

  const fontSize = clean.length > 90 ? 44 : clean.length > 50 ? 54 : 64;
  const maxChars = Math.max(12, Math.floor((WIDTH - 220) / (fontSize * 0.58)));
  const lines = wrapTitle(clean.toUpperCase(), maxChars);
  const lineHeight = Math.round(fontSize * 1.25);
  const textY = 250 - ((lines.length - 1) * lineHeight) / 2;

  // ВАЖНО: без letter-spacing. librsvg (SVG-рендерер sharp на сервере) считает
  // межбуквенный разрыв некорректно — символы наезжают друг на друга и слово
  // превращается в «иероглифы»/кляксу, хотя заголовок с тем же шрифтом читается.
  // Проверено по плашке: «PAGER» с letter-spacing="6" рендерится кашей.
  const titleLines = lines
    .map((line, i) =>
      `<text x="${WIDTH / 2}" y="${textY + i * lineHeight}" text-anchor="middle" font-size="${fontSize}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0c0c14"/>
      <stop offset="55%" stop-color="#151a2e"/>
      <stop offset="100%" stop-color="#2a1b4d"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.85)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.7)"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="1040" cy="90" r="210" fill="rgba(212,160,23,0.10)"/>
  <circle cx="150" cy="420" r="190" fill="rgba(255,255,255,0.04)"/>
  <circle cx="1110" cy="400" r="120" fill="rgba(0,0,0,0.18)"/>
  ${titleLines}
  <text x="${WIDTH / 2}" y="452" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="rgba(255,255,255,0.4)">SHARE THE STORY</text>
  <rect y="${HEIGHT - 140}" width="${WIDTH}" height="5" fill="#ffffff"/>
  <rect y="${HEIGHT - 135}" width="${WIDTH}" height="135" fill="url(#bar)"/>
  <text x="${WIDTH - 80}" y="${HEIGHT - 56}" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="end">PAGER MEDIA</text>
</svg>`;
}

/**
 * ГЕНЕРАТОР БАННЕРОВ С ПОДДЕРЖКОЙ КАРТИНОК
 *
 * Картинка грузится серверно (без внешних прокси), ресайзится под канвас OG
 * и собирается в JPEG через sharp. Никаких сторонних сервисов — это чинит OG-
 * превью для Twitter/CMC, которые перестали показывать баннер: раньше роут
 * зависел от wsrv.nl, который начал отдавать 404 на все IPFS-гейтвеи (пустой PNG).
 */
async function fetchSourceBuffer(url: string): Promise<Buffer | null> {
  const variants = ipfsGatewayVariants(url);

  // Гейтвеи опрашиваются ПАРАЛЛЕЛЬНО, а не по очереди. Раньше был строго
  // последовательный обход: если первый гейтвей тормозил, путь до рабочего
  // занимал до N×4с, и Twitter/CMC сдавались раньше, чем роут успевал что-то
  // вернуть → «чёрный» превью. Теперь время ответа = скорость самого быстрого
  // живого гейтвея (обычно сотни мс), а баг выбран по исходному порядку.
  const order = new Map(variants.map((v, i) => [v, i]));

  const attempts = await Promise.allSettled(
    variants.map(async (variant) => {
      const res = await fetch(variant, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      // Гейтвей может ответить 200 страницей-заглушкой (не картинкой) — это
      // уронит sharp ниже по цепочке и даст 500 вместо баннера. Проверяем.
      if (buffer.length < 16) throw new Error("empty body");
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height || !meta.format) throw new Error("not an image");
      return { variant, buffer };
    }),
  );

  const success = attempts
    .map((r, i) => (r.status === "fulfilled" ? { ...r.value, idx: order.get(r.value.variant) ?? i } : null))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.idx - b.idx);

  return success[0]?.buffer ?? null;
}

/**
 * Рендер реального баннера. Возвращает null, когда рисуется fallback-карточка:
 * исходник не скачался, не декодировался или post-обработка sharp упала.
 */
async function renderBannerCard(source: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(source)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
      .composite([{ input: FOOTER_SVG, gravity: 'south' }])
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    try {
      return await sharp(source)
        .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
        .composite([{ input: FOOTER_SVG, gravity: 'south' }])
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      return null;
    }
  }
}

/**
 * Рендер fallback-карточки. SVG растеризуется в 2x (density) для чёткости
 * текста, затем приводится к ровным 1200x630 — строго те же размеры, что у
 * кадрированного реального баннера, чтобы Twitter/CMC видели один формат.
 */
async function renderFallbackCard(title: string): Promise<Buffer> {
  return sharp(Buffer.from(buildFallbackSvg(title)), { density: 144 })
    .resize(WIDTH, HEIGHT, { fit: 'fill' })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const address = searchParams.get('address');

    let imageUrl = "";
    let cardTitle = "";
    const supabase = getSupabaseServer();

    if (id) {
      const { data } = await supabase.from('articles').select('image_url, title').eq('id', id).single();
      if (data) {
        imageUrl = data.image_url || "";
        cardTitle = data.title || "";
      }
    } else if (address) {
      const { data } = await supabase.from('profiles').select('avatar_url, name').eq('address', address.toLowerCase()).single();
      if (data) {
        imageUrl = data.avatar_url || "";
        cardTitle = data.name || "";
      }
    }

    const source = imageUrl ? await fetchSourceBuffer(imageUrl) : null;

    let jpeg: Buffer;
    let usedFallback: boolean;
    if (source) {
      const rendered = await renderBannerCard(source);
      if (rendered) {
        jpeg = rendered;
        usedFallback = false;
      } else {
        jpeg = await renderFallbackCard(cardTitle);
        usedFallback = true;
      }
    } else {
      jpeg = await renderFallbackCard(cardTitle);
      usedFallback = true;
    }

    // Важно: реальный баннер кэшируется на сутки, а fallback-карточка НЕ
    // кэшируется CDN (s-maxage=0). Раньше чёрная заглушка жила в CDN-кэше
    // 24 часа, и все соцсети продолжали показывать чёрный баннер даже после
    // того, как CID прогрелся на гейтвеях. Теперь fallback самовосстанавливается:
    // как только картинка поста доезжает до гейтвеев, повторный запрос бота
    // рендерит настоящий баннер и кладёт его в кэш.
    const cacheControl = usedFallback
      ? 'public, max-age=0, s-maxage=0'
      : 'public, s-maxage=86400, stale-while-revalidate=604800';

    return new Response(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': cacheControl,
        'Content-Length': String(jpeg.length),
        // Для самодиагностики: `real` — настоящий баннер, `fallback` — карточка.
        'X-OG-Variant': usedFallback ? 'fallback' : 'real',
      },
    });
  } catch (err) {
    return new Response(`Error`, { status: 500 });
  }
}