import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      console.error("❌ [Upload API] PINATA_JWT is not defined in .env");
      return NextResponse.json({ error: 'Pinata configuration missing on server' }, { status: 500 });
    }

    // Clean JWT: users often copy labels like "JWT" or spaces
    const cleanJwt = pinataJwt.trim().split(' ')[0].replace(/JWT$/, '');

    const pinataFormData = new FormData();
    pinataFormData.append('file', file);
    
    const metadata = JSON.stringify({ name: `pager-${Date.now()}-${file.name}` });
    pinataFormData.append('pinataMetadata', metadata);
    pinataFormData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    console.log("📡 [Upload API] Sending request to Pinata...");

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
