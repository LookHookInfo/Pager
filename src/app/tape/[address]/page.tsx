import { getSupabaseServer } from "@/lib/supabase";
import { Newspaper, Radio, ChevronLeft, ChevronRight } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import BannerImage from "@/components/BannerImage";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProfileHeader from "@/components/ProfileHeader";
import ProfileMascots from "@/components/ProfileMascots";
import DeleteButton from "@/components/DeleteButton";
import { Metadata } from 'next';
import { maskKey } from "@/lib/security";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ITEMS_PER_PAGE = 12;

async function getProfileData(address: string, page: number) {
  const supabase = getSupabaseServer();
  const cleanAddress = address.toLowerCase();
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;
  
  // 1. Получаем профиль
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq('address', cleanAddress)
    .maybeSingle();

  // Маскируем ключи для безопасности на фронтенде
  const safeProfile = profile ? {
    ...profile,
    ai_api_key: profile.ai_api_key ? maskKey(profile.ai_api_key) : "",
    binance_accounts: (profile.binance_accounts || []).map((acc: any) => ({
      ...acc,
      apiKey: acc.apiKey ? maskKey(acc.apiKey) : ""
    }))
  } : null;

  // 2. Получаем общее количество наград и статей (нужно для хедера)
  const { data: allStats } = await supabase
    .from("articles")
    .select("likes")
    .eq('author_address', cleanAddress);
  
  const totalArticlesCount = allStats?.length || 0;
  const totalRewards = allStats?.reduce((sum, art) => sum + (art.likes || 0), 0) || 0;

  // 3. Получаем статьи только для текущей страницы (оптимизировано)
  const { data: articles, error, count } = await supabase
    .from("articles")
    .select("id, title, content, image_url, author_address, created_at, likes", { count: 'exact' })
    .eq('author_address', cleanAddress)
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    profile: safeProfile || { address: cleanAddress, name: "Anonymous Author" },
    articles: articles || [],
    totalArticles: totalArticlesCount,
    totalRewards,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
  };
}

export async function generateMetadata({ params }: { params: { address: string } }): Promise<Metadata> {
  const supabase = getSupabaseServer();
  const address = decodeURIComponent(params.address).toLowerCase();
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, bio")
    .eq('address', address)
    .maybeSingle();

  const name = profile?.name || "Anonymous Author";
  const bio = profile?.bio || `Intel feed from ${address.slice(0, 6)}...${address.slice(-4)}`;
  const ogImageUrl = `/api/og?address=${address}`;

  return {
    title: `${name} | Pager Tape`,
    description: bio,
    openGraph: {
      title: `${name}'s Tape on Pager`,
      description: bio,
      url: `/tape/${address}`,
      siteName: 'Pager',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${name} on Pager`,
        },
      ],
      locale: 'en_US',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} on Pager`,
      description: bio,
      images: [ogImageUrl],
    },
  };
}

const stripHtml = (html: string) => {
  return html.replace(/<[^>]*>?/gm, '');
};

export default async function TapePage({ 
  params, 
  searchParams 
}: { 
  params: { address: string }, 
  searchParams: { page?: string } 
}) {
  const decodedAddress = decodeURIComponent(params.address);
  const currentPage = Number(searchParams.page) || 1;
  
  const { 
    profile, 
    articles, 
    totalArticles, 
    totalRewards, 
    totalPages 
  } = await getProfileData(decodedAddress, currentPage);

  return (
    <main className="min-h-screen bg-[var(--bg-main)]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <ProfileHeader 
          profile={profile} 
          totalArticles={totalArticles}
          totalRewards={totalRewards}
        />

        <ProfileMascots address={decodedAddress} />

        <section className="space-y-12">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 border-b border-[var(--border-soft)] pb-4">Feed</h2>
          
          {articles.length > 0 ? (
            <div className="space-y-16">
              {articles.map(article => (
                <article key={article.id} className="flex flex-col md:flex-row gap-10 group relative">
                  <div className="flex-[2] space-y-4">
                    <div className="flex items-center justify-between">
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
                        <BannerImage
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

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="mt-24 pt-12 border-t border-[var(--border-soft)] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tape Page</span>
              <span className="text-sm font-black uppercase">{currentPage} of {totalPages}</span>
            </div>
            
            <div className="flex items-center gap-4">
              {currentPage > 1 ? (
                <Link 
                  href={`/tape/${decodedAddress}?page=${currentPage - 1}`}
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
                  href={`/tape/${decodedAddress}?page=${currentPage + 1}`}
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
      </div>
    </main>
  );
}
