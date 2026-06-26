import { supabase } from "@/lib/supabase";
import { ArrowUpRight, Newspaper, Radio, ChevronLeft, ChevronRight } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ITEMS_PER_PAGE = 12;

async function getArticles(page: number) {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  // Оптимизация: выбираем только нужные поля для превью, НЕ тянем тяжелый content
  const { data, error, count } = await supabase
    .from("articles")
    .select("id, title, content, image_url, author_address, created_at, likes", { count: 'exact' })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Fetch error:", error);
    return { articles: [], totalPages: 0 };
  }
  
  return { 
    articles: data || [], 
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE) 
  };
}

const stripHtml = (html: string) => {
  return html.replace(/<[^>]*>?/gm, '');
};

export default async function Home({ searchParams }: { searchParams: { page?: string } }) {
  const currentPage = Number(searchParams.page) || 1;
  const { articles, totalPages } = await getArticles(currentPage);

  return (
    <main className="min-h-screen bg-[var(--bg-main)]">
      <Navbar />

      <section className="max-w-7xl mx-auto px-4 md:px-10 pt-20 pb-16 border-b border-[var(--border-soft)]">
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-7xl typography-title mb-6">Post your <span className="text-[var(--text-secondary)]">opinion.</span></h1>
          <p className="text-xl text-[var(--text-secondary)] leading-relaxed">Web3 media community of $HASH on the Base network.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-10 py-12">
        <div className="space-y-16">
          {articles.map((article) => (
            <article key={article.id} className="flex flex-col md:flex-row gap-10 group">
              <div className="flex-[2] flex flex-col justify-between py-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    <span className="text-black leading-none">
                      <Radio size={14} strokeWidth={3} />
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
                  <Link href={`/article/${article.id}`}>
                    <h2 className="text-2xl md:text-3xl typography-title group-hover:text-[var(--text-secondary)] transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                  </Link>
                  <p className="text-[var(--text-secondary)] line-clamp-3 text-lg leading-relaxed typography-body">
                    {stripHtml(article.content)}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-8">
                  <LikeButton articleId={article.id} initialLikes={article.likes || 0} authorAddress={article.author_address} />
                  <Link href={`/article/${article.id}`} className="text-[var(--text-secondary)] hover:text-black transition-colors"><ArrowUpRight size={20} /></Link>
                </div>
              </div>
              <Link href={`/article/${article.id}`} className="flex-1 order-first md:order-last flex items-center justify-center">
                <div className="w-full aspect-video overflow-hidden bg-gray-100 border border-[var(--border-soft)] rounded-sm">
                  {article.image_url ? (
                    <img 
                      src={article.image_url} 
                      alt={article.title} 
                      className="w-full h-full object-cover object-center grayscale-[0.2] hover:grayscale-0 transition-all duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Newspaper size={40} className="text-gray-200" />
                    </div>
                  )}
                </div>
              </Link>
            </article>
          ))}
          
          {articles.length === 0 && (
            <div className="py-20 text-center text-[var(--text-secondary)]">
              No articles found.
            </div>
          )}
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="mt-24 pt-12 border-t border-[var(--border-soft)] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Edition</span>
              <span className="text-sm font-black uppercase">{currentPage} of {totalPages}</span>
            </div>
            
            <div className="flex items-center gap-4">
              {currentPage > 1 ? (
                <Link 
                  href={`/?page=${currentPage - 1}`}
                  className="p-3 border border-black hover:bg-black hover:text-white transition-all rounded-sm"
                >
                  <ChevronLeft size={20} />
                </Link>
              ) : (
                <div className="p-3 border border-[var(--border-soft)] text-gray-300 cursor-not-allowed">
                  <ChevronLeft size={20} />
                </div>
              )}
              
              {currentPage < totalPages ? (
                <Link 
                  href={`/?page=${currentPage + 1}`}
                  className="p-3 border border-black hover:bg-black hover:text-white transition-all rounded-sm"
                >
                  <ChevronRight size={20} />
                </Link>
              ) : (
                <div className="p-3 border border-[var(--border-soft)] text-gray-300 cursor-not-allowed">
                  <ChevronRight size={20} />
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
