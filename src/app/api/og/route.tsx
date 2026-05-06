import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    let title = "Pager Story";
    let author = "Web3 Author";

    // Пытаемся получить данные, но если не выйдет - пойдем дальше с дефолтными
    if (id) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase
            .from('articles')
            .select('title, author_address')
            .eq('id', id)
            .single();
          
          if (data) {
            title = data.title;
            author = data.author_address || author;
          } else {
            title = "Article not found";
          }
        }
      } catch (dbError) {
        title = "DB Connection Error";
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
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            padding: '80px',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '40px', fontWeight: '900', textTransform: 'uppercase' }}>Pager</div>
            <div style={{ marginLeft: '20px', padding: '5px 10px', backgroundColor: 'black', color: 'white', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold' }}>BASE</div>
          </div>
          
          <div style={{ fontSize: '70px', fontWeight: 'bold', color: 'black', marginBottom: '50px', display: 'flex' }}>
            {title}
          </div>
          
          <div style={{ marginTop: 'auto', display: 'flex', width: '100%', borderTop: '2px solid black', paddingTop: '30px' }}>
            <div style={{ fontSize: '24px', color: '#666' }}>
              {author.slice(0, 15)}...
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
    // Если упало ВООБЩЕ всё, вернем просто текст ошибки
    return new Response(`Critical Error: ${err.message}`, { status: 500 });
  }
}
