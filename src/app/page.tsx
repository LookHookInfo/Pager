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

  if (error) {
    console.error("Fetch error:", error);
    return { articles: [], totalPages: 0 };
  }

  return {
    articles: data || [],
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
  };
}

export default async function Home({ searchParams }: { searchParams: { page?: string } }) {
  const currentPage = Number(searchParams.page) || 1;
  const { articles, totalPages } = await getArticles(currentPage);

  return (
    <main className="min-h-screen bg-[var(--bg-main)]">
      <Navbar />

      <section className="max-w-7xl mx-auto px-4 md:px-10 pt-20 pb-12 border-b border-[var(--border-soft)]">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Post your opinion.
          </h1>
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
            Web3 media community of $HASH on the Base network.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-10 py-12">
        <div className="space-y-14">
          {articles.map((article) => (
            <article key={article.id} className="flex flex-col md:flex-row gap-8 group">
              <div className="flex-[2] flex flex-col justify-between py-1">
                <div className="space-y-3">
                  <div className="text-xs text-[var(--text-secondary)]">
                    {new Date(article.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric"
                    })}
                  </div>
                  <Link href={`/article/${article.id}`}>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-snug group-hover:text-[var(--text-secondary)] transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                  </Link>
                  <p className="text-lg text-[var(--text-secondary)] leading-relaxed line-clamp-3 typography-body">
                    {stripHtml(article.content)}
                  </p>
                </div>
                <div className="mt-6">
                  <LikeButton articleId={article.id} initialLikes={article.likes || 0} authorAddress={article.author_address} />
                </div>
              </div>
              <Link href={`/article/${article.id}`} className="flex-1 order-first md:order-last">
                <div className="w-full aspect-[4/3] overflow-hidden bg-gray-100 border border-[var(--border-soft)] rounded-lg">
                  {article.image_url ? (
                    <BannerImage
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Newspaper size={32} className="text-gray-200" />
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

        {totalPages > 1 && (
          <div className="mt-20 pt-10 border-t border-[var(--border-soft)] flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">
              Page {currentPage} of {totalPages}
            </span>

            <div className="flex items-center gap-3">
              {currentPage > 1 ? (
                <Link
                  href={`/?page=${currentPage - 1}`}
                  className="p-2.5 rounded-full border border-black hover:bg-black hover:text-white transition-all"
                >
                  <ChevronLeft size={18} />
                </Link>
              ) : (
                <div className="p-2.5 rounded-full border border-[var(--border-soft)] text-gray-300 cursor-not-allowed">
                  <ChevronLeft size={18} />
                </div>
              )}

              {currentPage < totalPages ? (
                <Link
                  href={`/?page=${currentPage + 1}`}
                  className="p-2.5 rounded-full border border-black hover:bg-black hover:text-white transition-all"
                >
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <div className="p-2.5 rounded-full border border-[var(--border-soft)] text-gray-300 cursor-not-allowed">
                  <ChevronRight size={18} />
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
