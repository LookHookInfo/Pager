import { supabase } from "@/lib/supabase";
import { Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import BannerImage from "@/components/BannerImage";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { stripHtml } from "@/lib/utils";

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const ITEMS_PER_PAGE = 12;

async function getArticles(page: number) {
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from("articles")
    .select("id, title, content, image_url, author_address, created_at, likes", { count: 'exact' })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { articles: [], totalPages: 0 };

  return {
    articles: data || [],
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
  };
}

export default async function Home({ searchParams }: { searchParams: { page?: string } }) {
  const currentPage = Number(searchParams.page) || 1;
  const { articles, totalPages } = await getArticles(currentPage);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-16 pb-10 border-b border-[var(--border)]">
        <div className="max-w-xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Post your opinion.
          </h1>
          <p className="text-[15px] text-[var(--text-dim)] leading-relaxed">
            Web3 media community of $HASH on the Base network.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <div className="space-y-10">
          {articles.map((article) => (
            <article key={article.id} className="flex flex-col md:flex-row gap-6 group">
              <div className="flex-[2] flex flex-col justify-between py-1 min-w-0">
                <div className="space-y-2">
                  <div className="text-[11px] text-[var(--text-dim)] font-medium">
                    {new Date(article.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "2-digit", year: "numeric"
                    })}
                  </div>
                  <Link href={`/article/${article.id}`}>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-snug group-hover:text-[var(--text-dim)] transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                  </Link>
                  <p className="text-[15px] text-[var(--text-dim)] leading-relaxed line-clamp-2 typography-body">
                    {stripHtml(article.content)}
                  </p>
                </div>
                <div className="mt-4">
                  <LikeButton articleId={article.id} initialLikes={article.likes || 0} authorAddress={article.author_address} />
                </div>
              </div>
              {article.image_url ? (
                <Link href={`/article/${article.id}`} className="flex-1 order-first md:order-last shrink-0">
                  <div className="w-full aspect-[4/3] overflow-hidden rounded-xl bg-[var(--surface-dim)] border border-[var(--border)]">
                    <BannerImage
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                </Link>
              ) : null}
            </article>
          ))}

          {articles.length === 0 && (
            <div className="py-20 text-center text-[var(--text-dim)] text-[15px]">
              No articles found.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-16 pt-8 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-[13px] text-[var(--text-dim)]">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link href={`/?page=${currentPage - 1}`} className="btn btn--ghost btn--sm">
                  <ChevronLeft size={14} /> Prev
                </Link>
              ) : (
                <span className="btn btn--ghost btn--sm opacity-40 pointer-events-none">
                  <ChevronLeft size={14} /> Prev
                </span>
              )}
              {currentPage < totalPages ? (
                <Link href={`/?page=${currentPage + 1}`} className="btn btn--primary btn--sm">
                  Next <ChevronRight size={14} />
                </Link>
              ) : (
                <span className="btn btn--primary btn--sm opacity-40 pointer-events-none">
                  Next <ChevronRight size={14} />
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
