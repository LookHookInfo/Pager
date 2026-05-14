import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info').replace(/\/$/, '');
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/write'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
