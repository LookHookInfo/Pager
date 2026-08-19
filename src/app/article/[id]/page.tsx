import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getSupabaseServer } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/site';
import LikeButton from '@/components/LikeButton';
import Navbar from '@/components/Navbar';
import BackButton from '@/components/BackButton';
import PostActions from '@/components/PostActions';
import BannerImage from '@/components/BannerImage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getArticle(id: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('articles').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

async function getAuthorProfile(address: string) {
  const supabase = getSupabaseServer();
  const { data } = await supabase.from('profiles').select('cmc_username, name, avatar_url').eq('address', address.toLowerCase()).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const article = await getArticle(params.id);
  
  if (!article) {
    return {
      title: 'Article Not Found - Pager',
    };
  }

  const cleanContent = (article.content || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  const description = cleanContent.slice(0, 160) + (cleanContent.length > 160 ? '...' : '');
  const baseUrl = getSiteUrl();
  const articleUrl = `${baseUrl}/article/${article.id}`;
  const ogImageUrl = `${baseUrl}/api/og?id=${article.id}`;
  
  return {
    title: article.title,
    description: description,
    alternates: { 
      canonical: articleUrl 
    },
    openGraph: {
      title: article.title,
      description: description,
      url: articleUrl,
      siteName: 'Pager',
      images: [
        { 
          url: ogImageUrl, 
          width: 1200, 
          height: 630, 
          alt: article.title 
        }
      ],
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: description,
      images: [ogImageUrl],
    },
  };
}

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await getArticle(params.id);
  if (!article) notFound();
  const authorProfile = await getAuthorProfile(article.author_address);
  const jsonLd = { "@context": "https://schema.org", "@type": "NewsArticle", "headline": article.title, "image": [article.image_url], "datePublished": article.created_at, "author": [{ "@type": "Person", "name": article.author_address, "url": `${getSiteUrl()}/tape/${article.author_address}` }] };
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <article className="max-w-3xl mx-auto px-4 md:px-8 pt-12 md:pt-16 pb-20">
        <header className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs text-[var(--text-dim)]">
              {new Date(article.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
            </div>
            <BackButton />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-8 leading-tight">{article.title}</h1>
          <div className="flex items-center gap-3 py-5 border-t border-[var(--border)]">
             <Link href={`/tape/${article.author_address}`} className="shrink-0">
               <div className="avatar avatar--sm border border-[var(--border)]">
                 {authorProfile?.avatar_url ? (
                   <img src={authorProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-[10px] font-bold">{(authorProfile?.name || "0x").charAt(0)}</span>
                 )}
               </div>
             </Link>
             <div className="flex flex-col">
               <Link href={`/tape/${article.author_address}`} className="text-[13px] font-bold hover:underline">{authorProfile?.name || "Anonymous Author"}</Link>
               <span className="text-[10px] text-[var(--text-faint)] font-mono">{article.author_address.slice(0,6)}...{article.author_address.slice(-4)}</span>
             </div>
          </div>
        </header>
        {article.image_url && (() => {
          const tokenMatch = (article.content || '').match(/pager\.lookhook\.info\/token\/([a-fA-F0-9x]+)/i);
          const tokenLink = tokenMatch ? `/token/${tokenMatch[1]}` : null;
          return (
            <div className="w-full mb-14 flex justify-center">
              <div className="w-full max-w-4xl aspect-[4/3] overflow-hidden bg-[var(--surface-dim)] border border-[var(--border)] rounded-xl">
                {tokenLink ? (
                  <Link href={tokenLink} className="block w-full h-full">
                    <BannerImage src={article.image_url} alt={article.title} className="w-full h-full object-cover object-center" />
                  </Link>
                ) : (
                  <BannerImage src={article.image_url} alt={article.title} className="w-full h-full object-cover object-center" />
                )}
              </div>
            </div>
          );
        })()}
        <div className="prose prose-xl prose-stone max-w-none typography-body text-[var(--text)] mb-14" dangerouslySetInnerHTML={{ __html: article.content }} />
        <footer className="pt-8 border-t border-[var(--border)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-6">
                 <LikeButton articleId={article.id} initialLikes={article.likes || 0} authorAddress={article.author_address} />
                 <PostActions title={article.title} id={article.id} content={article.content} imageUrl={article.image_url} cmcUsername={authorProfile?.cmc_username} authorAddress={article.author_address} />
              </div>
              {article.source_url && (
                <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5">Source <ExternalLink size={12} /></a>
              )}
            </div>
            <div className="flex justify-end">
              <Link href="/" className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">← Back to Feed</Link>
            </div>
          </div>
        </footer>
      </article>
    </main>
  );
}
