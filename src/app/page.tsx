import { supabase } from "@/lib/supabase";
import { ArrowUpRight, Newspaper } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getLanguageIcon } from "@/lib/lang";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getArticles() {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch error:", error);
    return [];
  }
  return data;
}

const stripHtml = (html: string) => {
  return html.replace(/<[^>]*>?/gm, '');
};

export default async function Home() {
  const articles = await getArticles();

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
                <div className="w-full aspect-[16/10] overflow-hidden bg-gray-100 border border-[var(--border-soft)] rounded-sm">
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
      </section>
    </main>
  );
}
