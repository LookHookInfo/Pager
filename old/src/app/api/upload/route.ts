import { NextResponse } from 'next/server';

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

    const pinataFormData = new FormData();
    pinataFormData.append('file', file);
    
    const metadata = JSON.stringify({ 
      name: `pager-${Date.now()}-${file.name}`,
      keyvalues: { project: 'Pager', timestamp: Date.now().toString() }
    });
    pinataFormData.append('pinataMetadata', metadata);
    pinataFormData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    console.log("📡 [Upload API] Sending request to Pinata... (Token length:", cleanJwt.length, ")");

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanJwt}`,
      },
      body: pinataFormData,
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error(`❌ [Pinata API] Error ${res.status}:`, responseText);
      return NextResponse.json({ 
        error: 'Pinata upload failed', 
        status: res.status,
        details: responseText 
      }, { status: res.status });
    }

    const data = JSON.parse(responseText);
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
    const publicUrl = `${gateway.endsWith('/') ? gateway : gateway + '/'}${data.IpfsHash}`;

    console.log("✅ [Upload API] Success! IPFS URL:", publicUrl);

    return NextResponse.json({ 
      success: true, 
      ipfsHash: data.IpfsHash, 
      url: publicUrl 
    });

  } catch (error: any) {
    console.error("❌ [Upload API] Critical Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
