import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Share2, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import LikeButton from '@/components/LikeButton';
import { getLanguageIcon } from '@/lib/lang';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getArticle(id: string) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await getArticle(params.id);

  if (!article) {
    notFound();
  }

  return (
    <main className="min-h-screen pb-24">
      <nav className="sticky top-0 z-50 bg-[var(--bg-main)]/90 backdrop-blur-sm border-b border-[var(--border-soft)]">
        <div className="max-w-7xl mx-auto px-4 md:px-10 h-16 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--text-secondary)] transition-colors">
            <ArrowLeft size={18} />
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-4 text-[var(--text-secondary)]">
            <button className="hover:text-black transition-colors"><Bookmark size={18} /></button>
            <button className="hover:text-black transition-colors"><Share2 size={18} /></button>
          </div>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 pt-16 md:pt-24">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-8 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
            <span className="text-sm font-serif italic text-black leading-none">
              {getLanguageIcon(article.content, article.lang)}
            </span>
            <span className="text-[var(--border-soft)]">/</span>
            <span>
              {new Date(article.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric"
              })}
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl typography-title mb-10 leading-[1.05]">
            {article.title}
          </h1>

          <div className="flex items-center gap-3 py-6 border-t border-[var(--border-soft)]">
             <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-[var(--border-soft)]">
                <Link href={`/tape/${article.author_address}`}>
                   <div className="w-full h-full rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                     <span className="text-[10px] font-bold">0x</span>
                   </div>
                </Link>
             </div>
             <div className="flex flex-col">
                <Link href={`/tape/${article.author_address}`} className="text-sm font-bold hover:underline">
                   Author Tape
                </Link>
                <span className="text-[10px] text-gray-400 font-mono">{article.author_address.slice(0,6)}...{article.author_address.slice(-4)}</span>
             </div>
          </div>
        </header>

        {article.image_url && (
          <div className="w-full mb-16 flex justify-center">
            <div className="w-full max-w-5xl aspect-[21/9] overflow-hidden bg-gray-100 border border-[var(--border-soft)] rounded-sm">
              <img 
                src={article.image_url} 
                alt={article.title} 
                className="w-full h-full object-cover object-center grayscale-[0.1] hover:grayscale-0 transition-all duration-700" 
              />
            </div>
          </div>
        )}

        {/* Рендеринг HTML контента с использованием prose */}
        <div 
          className="prose prose-xl prose-stone max-w-none typography-body text-[var(--text-primary)] mb-20"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <footer className="pt-12 border-t border-[var(--border-soft)] flex flex-col gap-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-6">
               <LikeButton 
                 articleId={article.id} 
                 initialLikes={article.likes || 0} 
                 authorAddress={article.author_address} 
               />
               {article.source_url && (
                 <a 
                   href={article.source_url} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="btn-secondary rounded-none px-8 py-3 text-xs"
                 >
                   Original Source <ExternalLink size={14} />
                 </a>
               )}
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-[0.2em] mb-1">Curated by</span>
              <span className="font-bold text-lg tracking-tighter uppercase">Pager</span>
            </div>
          </div>
        </footer>
      </article>
    </main>
  );
}
