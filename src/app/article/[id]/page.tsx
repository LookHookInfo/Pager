import { notFound } from 'next/navigation';
import { ExternalLink, Radio } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import LikeButton from '@/components/LikeButton';
import Navbar from '@/components/Navbar';
import BackButton from '@/components/BackButton';
import PostActions from '@/components/PostActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getArticle(id: string) {
  const { data, error } = await supabase.from('articles').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const article = await getArticle(params.id);
  if (!article) return {};
  const description = article.content.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().slice(0, 160) + '...';
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info').replace(/\/$/, '');
  const ogImageUrl = `${baseUrl}/api/og?id=${article.id}`;
  return {
    title: article.title,
    description: description,
    alternates: { canonical: `/article/${article.id}` },
    openGraph: {
      title: article.title,
      description: description,
      url: `${baseUrl}/article/${article.id}`,
      siteName: 'Pager',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: article.title }],
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
  const jsonLd = { "@context": "https://schema.org", "@type": "NewsArticle", "headline": article.title, "image": [article.image_url], "datePublished": article.created_at, "author": [{ "@type": "Person", "name": article.author_address, "url": `${process.env.NEXT_PUBLIC_SITE_URL}/tape/${article.author_address}` }] };
  return (
    <main className="min-h-screen bg-[var(--bg-main)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 pt-16 md:pt-24 pb-24">
        <header className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              <span className="text-black leading-none"><Radio size={14} strokeWidth={3} /></span>
              <span className="text-[var(--border-soft)]">/</span>
              <span>{new Date(article.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>
            </div>
            <BackButton />
          </div>
          <h1 className="text-4xl md:text-6xl typography-title mb-10 leading-[1.05]">{article.title}</h1>
          <div className="flex items-center gap-3 py-6 border-t border-[var(--border-soft)]">
             <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-[var(--border-soft)]">
                <Link href={`/tape/${article.author_address}`}><div className="w-full h-full rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"><span className="text-[10px] font-bold">0x</span></div></Link>
             </div>
             <div className="flex flex-col">
                <Link href={`/tape/${article.author_address}`} className="text-sm font-bold hover:underline">Author Tape</Link>
                <span className="text-[10px] text-gray-400 font-mono">{article.author_address.slice(0,6)}...{article.author_address.slice(-4)}</span>
             </div>
          </div>
        </header>
        {article.image_url && (
          <div className="w-full mb-16 flex justify-center">
            <div className="w-full max-w-5xl aspect-[21/9] overflow-hidden bg-gray-100 border border-[var(--border-soft)] rounded-sm shadow-xl">
              <img src={article.image_url} alt={article.title} className="w-full h-full object-cover object-center grayscale-[0.05] hover:grayscale-0 transition-all duration-1000 ease-in-out" />
            </div>
          </div>
        )}
        <div className="prose prose-xl prose-stone max-w-none typography-body text-[var(--text-primary)] mb-20" dangerouslySetInnerHTML={{ __html: article.content }} />
        <footer className="pt-12 border-t border-[var(--border-soft)]">
          <div className="flex flex-col gap-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-8">
                 <LikeButton articleId={article.id} initialLikes={article.likes || 0} authorAddress={article.author_address} />
                 <PostActions title={article.title} id={article.id} />
              </div>
              {article.source_url && (
                <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-black transition-colors flex items-center gap-2">Source <ExternalLink size={14} /></a>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border-soft)] pt-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-[0.2em] mb-1">Curated by</span>
                <span className="font-bold text-lg tracking-tighter uppercase leading-none">Pager AI</span>
              </div>
              <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-black transition-colors">Back to Feed</Link>
            </div>
          </div>
        </footer>
      </article>
    </main>
  );
}
