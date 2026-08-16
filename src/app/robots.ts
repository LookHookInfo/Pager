import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/og'],
      disallow: ['/write', '/api/ai', '/api/article', '/api/profile'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
