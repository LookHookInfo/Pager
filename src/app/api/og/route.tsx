import { ImageResponse } from 'next/og';
import { getSupabaseServer } from '@/lib/supabase';
import { normalizeIpfs } from '@/lib/ipfs';

export const runtime = 'edge';

/**
 * ОПТИМИЗИРОВАННЫЙ ГЕНЕРАТОР БАННЕРОВ С ПОДДЕРЖКОЙ КАРТИНОК
 * 
 * Мы используем прокси-сервис weserv.nl для мгновенной обработки картинок из IPFS.
 * Это позволяет сжать тяжелую картинку до минимума перед тем, как Edge-функция 
 * попытается её отрисовать.
 */

function getOptimizedImageUrl(url: string) {
  if (!url) return "";
  
  let rawUrl = normalizeIpfs(url);

  // Используем wsrv.nl для ресайза и сжатия "на лету"
  // w=1200 - ширина
  // h=630 - высота
  // fit=cover - обрезка
  // output=jpg - формат
  // q=70 - качество
  // a=attention - фокус на важном (лицах и т.д.)
  return `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=1200&h=630&fit=cover&output=jpg&q=70&a=attention`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const address = searchParams.get('address');
    
    let bannerUrl = "";

    const supabase = getSupabaseServer();

    if (id) {
      const { data } = await supabase.from('articles').select('image_url').eq('id', id).single();
      if (data) {
        bannerUrl = getOptimizedImageUrl(data.image_url || "");
      }
    } else if (address) {
      const { data } = await supabase.from('profiles').select('avatar_url').eq('address', address.toLowerCase()).single();
      if (data) {
        bannerUrl = getOptimizedImageUrl(data.avatar_url || "");
      }
    }

    return new ImageResponse(
      (
        <div style={{ 
          height: '100%', 
          width: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#000', 
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* ФОНОВОЕ ИЗОБРАЖЕНИЕ — яркое, без затемнения */}
          {bannerUrl && (
            <img 
              src={bannerUrl} 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                opacity: 1,
              }} 
            />
          )}

          {/* Контент прижат к низу */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            width: '100%',
            height: '100%',
            position: 'relative',
            zIndex: 10
          }}>
            {/* Белая разделяющая черта */}
            <div style={{ 
              width: '100%',
              borderTop: '5px solid white',
              marginBottom: '0'
            }} />

            {/* Нижняя панель с затемнением только под чертой */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '32px 80px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 100%)',
            }}>
              <div style={{ fontSize: '28px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.03em', color: 'white' }}>Pager Media</div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (err: any) { 
    return new Response(`Error`, { status: 500 }); 
  }
}
