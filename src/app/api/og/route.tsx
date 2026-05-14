import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

// Хелпер для превращения ipfs:// в рабочую ссылку для Edge-функции
function resolveIpfs(url: string) {
  if (!url) return "";
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://gateway.ipn.io/ipfs/');
  }
  return url;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const address = searchParams.get('address');

    let title = "Pager - Web3 Media";
    let subTitle = "A minimalist decentralized news platform built on Base.";
    let imageUrl = "";
    let isProfile = false;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (id) {
      const { data } = await supabase
        .from('articles')
        .select('title, content, image_url, author_address')
        .eq('id', id)
        .single();
      
      if (data) {
        title = data.title;
        subTitle = data.content.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().slice(0, 100) + '...';
        imageUrl = resolveIpfs(data.image_url || "");
      }
    } else if (address) {
      isProfile = true;
      const { data } = await supabase
        .from('profiles')
        .select('name, bio, avatar_url')
        .eq('address', address.toLowerCase())
        .single();
      
      if (data) {
        title = data.name || "Anonymous Author";
        subTitle = data.bio || `View the Web3 feed of ${address.slice(0, 6)}...${address.slice(-4)}`;
        imageUrl = resolveIpfs(data.avatar_url || "");
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            backgroundColor: '#ffffff',
            padding: '80px',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Background Image / Overlay */}
          {imageUrl && (
            <img 
              src={imageUrl} 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.2,
                filter: 'grayscale(1)',
              }}
            />
          )}

          {/* Top Logo */}
          <div style={{ position: 'absolute', top: '80px', left: '80px', display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.05em', color: 'black' }}>Pager</div>
            <div style={{ marginLeft: '12px', width: '2px', height: '24px', backgroundColor: '#000' }} />
            <div style={{ marginLeft: '12px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#6b7280' }}>
              {isProfile ? 'Protocol / Tape' : 'Intel / Report'}
            </div>
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '900px', position: 'relative', zIndex: 10 }}>
            <div style={{ 
              fontSize: title.length > 40 ? '64px' : '84px', 
              fontWeight: '900', 
              color: 'black', 
              marginBottom: '24px',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}>
              {title}
            </div>
            
            <div style={{ 
              fontSize: '32px', 
              color: '#374151', 
              lineHeight: 1.4,
              marginBottom: '48px',
              fontWeight: 'bold',
            }}>
              {subTitle}
            </div>
          </div>
          
          <div style={{ display: 'flex', width: '100%', borderTop: '4px solid black', paddingTop: '32px', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
               <div style={{ padding: '8px 16px', backgroundColor: 'black', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
                 <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>Base Network</div>
               </div>
               <div style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}>lookhook.info</div>
            </div>
            <div style={{ fontSize: '18px', color: '#000', fontWeight: '900', textTransform: 'uppercase' }}>
              Web3 Media Protocol
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err: any) {
    console.error("OG Error:", err.message);
    return new Response(`OG Generation Error`, { status: 500 });
  }
}
