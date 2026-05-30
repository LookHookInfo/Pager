import { ImageResponse } from 'next/og';
import { getSupabaseServer } from '@/lib/supabase';

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
  
  let rawUrl = url;
  if (url.startsWith('ipfs://')) {
    rawUrl = url.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
  }

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
    
    let title = "Pager - Web3 Media";
    let subTitle = "A minimalist decentralized news platform built on Base.";
    let label = "Intel / Report";
    let bannerUrl = "";

    const supabase = getSupabaseServer();

    if (id) {
      const { data } = await supabase.from('articles').select('title, content, image_url').eq('id', id).single();
      if (data) {
        title = data.title;
        subTitle = data.content.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().slice(0, 110) + '...';
        label = "Intel / Report";
        bannerUrl = getOptimizedImageUrl(data.image_url || "");
      }
    } else if (address) {
      const { data } = await supabase.from('profiles').select('name, bio, avatar_url').eq('address', address.toLowerCase()).single();
      if (data) {
        title = data.name || "Anonymous Author";
        subTitle = data.bio || `Web3 feed of ${address.slice(0, 6)}...${address.slice(-4)}`;
        label = "Protocol / Tape";
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
          alignItems: 'flex-start', 
          justifyContent: 'space-between', 
          backgroundColor: '#000', 
          padding: '80px', 
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* ФОНОВОЕ ИЗОБРАЖЕНИЕ (ОПТИМИЗИРОВАННОЕ) */}
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
                opacity: 0.5,
              }} 
            />
          )}

          {/* Затемнение фона для читаемости текста */}
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.9) 100%)',
            zIndex: 1
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative', zIndex: 10 }}>
            <div style={{ fontSize: '36px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.05em', color: 'white' }}>Pager</div>
            <div style={{ marginLeft: '16px', width: '3px', height: '28px', backgroundColor: '#fff' }} />
            <div style={{ marginLeft: '16px', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.3em', color: '#d1d5db' }}>
              {label}
            </div>
          </div>

          {/* Main Content */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '40px', position: 'relative', zIndex: 10 }}>
            <div style={{ 
              fontSize: title.length > 50 ? '60px' : '74px', 
              fontWeight: '900', 
              color: 'white', 
              marginBottom: '24px', 
              lineHeight: 1.1, 
              letterSpacing: '-0.02em',
              textShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              {title}
            </div>
            <div style={{ 
              fontSize: '30px', 
              color: '#e5e7eb', 
              lineHeight: 1.5, 
              fontWeight: '500', 
              maxWidth: '950px',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}>
              {subTitle}
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            display: 'flex', 
            width: '100%', 
            borderTop: '5px solid white', 
            paddingTop: '40px', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
               <div style={{ 
                 padding: '10px 20px', 
                 backgroundColor: 'white', 
                 borderRadius: '6px', 
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'center', 
                 marginRight: '20px' 
               }}>
                 <div style={{ color: 'black', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>Base Network</div>
               </div>
               <div style={{ fontSize: '24px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white' }}>lookhook.info</div>
            </div>
            <div style={{ fontSize: '20px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Web3 Protocol
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
