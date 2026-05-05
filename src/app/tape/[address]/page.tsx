import { supabase } from "@/lib/supabase";
import { Newspaper } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProfileHeader from "@/components/ProfileHeader";
import DeleteButton from "@/components/DeleteButton";
import { getLanguageIcon } from "@/lib/lang";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getProfileData(address: string) {
  const cleanAddress = address.toLowerCase();
  
  // Получаем профиль
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq('address', cleanAddress)
    .maybeSingle();

  // Получаем статьи
  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq('author_address', cleanAddress)
    .order("created_at", { ascending: false });

  return {
    profile: profile || { address: cleanAddress, name: "Anonymous Author" },
    articles: articles || []
  };
}

const stripHtml = (html: string) => {
  return html.replace(/<[^>]*>?/gm, '');
};

export default async function TapePage({ params }: { params: { address: string } }) {
  const decodedAddress = decodeURIComponent(params.address);
  const { profile, articles } = await getProfileData(decodedAddress);
  const totalRewards = articles.reduce((sum, art) => sum + (art.likes || 0), 0);

  return (
    <main className="min-h-screen bg-[var(--bg-main)]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <ProfileHeader 
          profile={profile} 
          totalArticles={articles.length}
          totalRewards={totalRewards}
        />

        <section className="space-y-12">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 border-b border-[var(--border-soft)] pb-4">Feed</h2>
          
          {articles.length > 0 ? (
            <div className="space-y-16">
              {articles.map(article => (
                <article key={article.id} className="flex flex-col md:flex-row gap-10 group relative">
                  <div className="flex-[2] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
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
                      <DeleteButton articleId={article.id} authorAddress={article.author_address} />
                    </div>
                    
                    <Link href={`/article/${article.id}`}>
                      <h3 className="text-2xl md:text-3xl typography-title group-hover:text-gray-500 transition-colors leading-tight">
                        {article.title}
                      </h3>
                    </Link>
                    <p className="text-gray-500 line-clamp-3 typography-body text-lg leading-relaxed">
                      {stripHtml(article.content)}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                       <LikeButton articleId={article.id} initialLikes={article.likes || 0} authorAddress={article.author_address} />
                       <Link href={`/article/${article.id}`} className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-0.5 hover:text-gray-500 hover:border-gray-300 transition-all">Open Story</Link>
                    </div>
                  </div>
                  <Link href={`/article/${article.id}`} className="flex-1">
                    <div className="aspect-[16/10] bg-white border border-[var(--border-soft)] overflow-hidden rounded-sm">
                      {article.image_url ? (
                        <img 
                          src={article.image_url} 
                          alt={article.title}
                          className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-100 bg-gray-50">
                          <Newspaper size={40} />
                        </div>
                      )}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center border border-dashed border-[var(--border-soft)]">
              <p className="text-gray-400 italic">No stories yet.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
