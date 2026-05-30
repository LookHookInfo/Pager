import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info').replace(/\/$/, '');
  
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/og'],
      disallow: ['/write', '/api/ai', '/api/article', '/api/distribution', '/api/profile'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
