import { getSupabaseServer } from '@/lib/supabase';
import { ipfsGatewayVariants } from '@/lib/ipfs';
import sharp from 'sharp';

export const maxDuration = 60;

const WIDTH = 1200;
const HEIGHT = 630;
const FETCH_TIMEOUT_MS = 6000;

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
    <text x="${WIDTH - 80}" y="84" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="end">PAGER MEDIA</text>
  </svg>`,
);

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
  for (const variant of variants) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(variant, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      continue;
    }
  }
  return null;
}

async function renderBannerCard(source: Buffer | null): Promise<Buffer> {
  const base = source
    ? sharp(source).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    : null;

  if (base) {
    try {
      return await base
        .composite([{ input: FOOTER_SVG, gravity: 'south' }])
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      // entropy crop unsupported here — fall back to centre crop below
    }
  }

  const centre = source
    ? sharp(source).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    : sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#000' } });

  return centre
    .composite([{ input: FOOTER_SVG, gravity: 'south' }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const address = searchParams.get('address');

    let imageUrl = "";
    const supabase = getSupabaseServer();

    if (id) {
      const { data } = await supabase.from('articles').select('image_url').eq('id', id).single();
      if (data) imageUrl = data.image_url || "";
    } else if (address) {
      const { data } = await supabase.from('profiles').select('avatar_url').eq('address', address.toLowerCase()).single();
      if (data) imageUrl = data.avatar_url || "";
    }

    const source = imageUrl ? await fetchSourceBuffer(imageUrl) : null;
    const jpeg = await renderBannerCard(source);

    return new Response(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'Content-Length': String(jpeg.length),
      },
    });
  } catch (err: any) {
    return new Response(`Error`, { status: 500 });
  }
}