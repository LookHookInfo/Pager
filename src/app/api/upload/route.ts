import { NextResponse } from 'next/server';
import { prewarmIpfs } from '@/lib/ipfs';
import { uploadBannerToStorage } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // File size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // File type validation: only images
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF, SVG' }, { status: 400 });
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      console.error("❌ [Upload API] PINATA_JWT is not defined in .env");
      return NextResponse.json({ error: 'Pinata configuration missing on server' }, { status: 500 });
    }

    // Robust JWT cleaning
    let cleanJwt = pinataJwt.trim();
    if (cleanJwt.startsWith('JWT ')) {
      cleanJwt = cleanJwt.substring(4).trim();
    } else if (cleanJwt.includes(' ')) {
      // Fallback: take the longest part which is likely the token
      cleanJwt = cleanJwt.split(/\s+/).reduce((a, b) => a.length > b.length ? a : b);
    }
    cleanJwt = cleanJwt.replace(/JWT$/, '');

    const formDataPinata = new FormData();
    formDataPinata.append('file', file);
    
    const metadata = JSON.stringify({ 
      name: `pager-${Date.now()}-${file.name}`,
      keyvalues: { project: 'Pager', timestamp: Date.now().toString() }
    });
    formDataPinata.append('pinataMetadata', metadata);
    formDataPinata.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    let attempts = 0;
    const maxAttempts = 3;
    const baseDelay = 2000;

    // Retry logic for Pinata plan usage limit
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanJwt}`,
          },
          body: formDataPinata,
        });

        if (!res.ok) {
          const err = await res.text().catch(() => "unknown");
          if (res.status === 403 && err.includes("Account blocked due to plan usage limit")) {
            if (attempts < maxAttempts) {
              const delay = baseDelay * attempts;
              console.warn(`Pinata plan limit hit, retry #${attempts} after ${delay}ms`);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
            console.error("Pinata plan usage limit exceeded after all retries");
            // Fallback to Supabase
            const buffer = Buffer.from(await file.arrayBuffer());
            const supUrl = await uploadBannerToStorage(buffer, file.type || "image/webp");
            if (supUrl) {
              await prewarmIpfs(supUrl);
              return NextResponse.json({ 
                success: true, 
                ipfsHash: null, 
                url: supUrl, 
                fallback: "supabase" 
              });
            }
            return NextResponse.json({ 
              error: 'Pinata plan limit exceeded and Supabase fallback failed', 
              status: 403 
            }, { status: 403 });
          }
          console.error(`Pinata API error ${res.status}:`, err);
          return NextResponse.json({ error: 'Pinata upload failed', status: res.status }, { status: res.status });
        }

        const data = await res.json();
        const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
        const publicUrl = `${gateway.endsWith('/') ? gateway : gateway + '/'}${data.IpfsHash}`;

        // Прогреваем гейтвеи сразу: свежий CID на них появляется с задержкой, а
        // аватар из URL вскоре задействует /api/og (профили) индексироваться ботами.
        await prewarmIpfs(publicUrl);

        return NextResponse.json({ 
          success: true, 
          ipfsHash: data.IpfsHash, 
          url: publicUrl 
        });

      } catch (e: any) {
        if (attempts < maxAttempts) {
          const delay = baseDelay * attempts;
          console.warn(`Pinata network error, retry #${attempts} after ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        console.error(`Pinata upload failed after ${attempts} attempts:`, e.message);
        // Fallback to Supabase on final attempt failure
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const supUrl = await uploadBannerToStorage(buffer, file.type || "image/webp");
          if (supUrl) {
            await prewarmIpfs(supUrl);
            return NextResponse.json({ 
              success: true, 
              ipfsHash: null, 
              url: supUrl, 
              fallback: "supabase" 
            });
          }
        } catch (supaErr: any) {
          console.error("Supabase fallback failed:", supaErr.message);
        }
        return NextResponse.json({ error: 'Pinata upload failed after retries', status: 500 }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Pinata upload failed after retries' }, { status: 500 });

  } catch (error: any) {
    console.error("❌ [Upload API] Critical Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}