import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  let articles: { id: string; created_at: string }[] | null = null;
  let profiles: { address: string }[] | null = null;

  try {
    const [a, p] = await Promise.all([
      supabase.from('articles').select('id, created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('address'),
    ]);
    articles = a.data;
    profiles = p.data;
  } catch {
    return [{ url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 }];
  }

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
    ...articleEntries,
    ...profileEntries,
  ];
}
