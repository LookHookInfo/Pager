import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info').replace(/\/$/, '');

  // Fetch all articles for sitemap
  const { data: articles } = await supabase
    .from('articles')
    .select('id, created_at')
    .order('created_at', { ascending: false });

  // Fetch all profiles/tapes
  const { data: profiles } = await supabase
    .from('profiles')
    .select('address');

  const articleEntries: MetadataRoute.Sitemap = (articles || []).map((article) => ({
    url: `${baseUrl}/article/${article.id}`,
    lastModified: new Date(article.created_at),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const profileEntries: MetadataRoute.Sitemap = (profiles || []).map((profile) => ({
    url: `${baseUrl}/tape/${profile.address}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/character`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/write`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
    ...articleEntries,
    ...profileEntries,
  ];
}
