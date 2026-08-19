import { getSupabaseServer } from "@/lib/supabase";
import { Newspaper, Radio, ChevronLeft, ChevronRight } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import BannerImage from "@/components/BannerImage";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ProfileHeader from "@/components/ProfileHeader";
import ProfileMascots from "@/components/ProfileMascots";
import GemFunCard from "@/components/GemFunCard";
import DeleteButton from "@/components/DeleteButton";
import { Metadata } from 'next';
import { sanitizeProfile } from "@/lib/security";
import { stripHtml } from "@/lib/utils";
import { fetchGemTokenData } from "@/lib/gemfun";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ITEMS_PER_PAGE = 12;

async function getProfileData(address: string, page: number) {
  const supabase = getSupabaseServer();
  const cleanAddress = address.toLowerCase();
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq('address', cleanAddress)
    .maybeSingle();

  const safeProfile = profile ? sanitizeProfile(profile) : null;

  const { data: allStats } = await supabase
    .from("articles")
    .select("likes")
    .eq('author_address', cleanAddress);

  const totalArticlesCount = allStats?.length || 0;
  const totalRewards = allStats?.reduce((sum, art) => sum + (art.likes || 0), 0) || 0;

  const { data: articles, count } = await supabase
    .from("articles")
    .select("id, title, content, image_url, author_address, created_at, likes", { count: 'exact' })
    .eq('author_address', cleanAddress)
    .order("created_at", { ascending: false })
    .range(from, to);

  let gemData = null;
  if (profile?.gemfun_token) {
    gemData = await fetchGemTokenData(profile.gemfun_token);
  }

  return {
    profile: safeProfile || { address: cleanAddress, name: "Anonymous Author" },
    articles: articles || [],
    totalArticles: totalArticlesCount,
    totalRewards,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
    gemData,
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${name} on Pager` }],
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

export default async function TapePage({
  params,
  searchParams,
}: {
  params: { address: string },
  searchParams: { page?: string }
}) {
  const decodedAddress = decodeURIComponent(params.address);
  const currentPage = Number(searchParams.page) || 1;

  const {
    profile, articles, totalArticles, totalRewards, totalPages, gemData,
  } = await getProfileData(decodedAddress, currentPage);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">
        <ProfileHeader
          profile={profile}
          totalArticles={totalArticles}
          totalRewards={totalRewards}
        />

        {gemData && (
          <GemFunCard tokenAddress={gemData.token} tokenData={gemData} />
        )}

        <ProfileMascots address={decodedAddress} />

        <section className="space-y-10">
          <h2 className="section-label border-b border-[var(--border)] pb-3">Feed</h2>

          {articles.length > 0 ? (
            <div className="space-y-10">
              {articles.map(article => (
                <article key={article.id} className="space-y-3 group relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-dim)]">
                      <Radio size={12} strokeWidth={2.5} className="text-[var(--text)]" />
                      <span className="text-[var(--border)]">/</span>
                      <span>
                        {new Date(article.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "2-digit", year: "numeric"
                        })}
                      </span>
                    </div>
                    <DeleteButton articleId={article.id} authorAddress={article.author_address} />
                  </div>

                  <Link href={`/article/${article.id}`}>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight group-hover:text-[var(--text-dim)] transition-colors leading-tight">
                      {article.title}
                    </h3>
                  </Link>

                  {article.image_url && (
                    <Link href={`/article/${article.id}`}>
                      <div className="aspect-[4/3] bg-[var(--surface-dim)] border border-[var(--border)] overflow-hidden rounded-xl">
                        <BannerImage
                          src={article.image_url}
                          alt={article.title}
                          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                        />
                      </div>
                    </Link>
                  )}

                  <p className="text-[15px] text-[var(--text-dim)] line-clamp-2 typography-body">
                    {stripHtml(article.content)}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <LikeButton articleId={article.id} initialLikes={article.likes || 0} authorAddress={article.author_address} />
                    <Link href={`/article/${article.id}`} className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
                      Read →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center border border-dashed border-[var(--border)] rounded-xl">
              <p className="text-[var(--text-dim)] text-[13px]">No stories yet.</p>
            </div>
          )}
        </section>

        {totalPages > 1 && (
          <div className="mt-16 pt-8 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-[13px] text-[var(--text-dim)]">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link href={`/tape/${decodedAddress}?page=${currentPage - 1}`} className="btn btn--ghost btn--sm">
                  <ChevronLeft size={14} /> Prev
                </Link>
              ) : (
                <span className="btn btn--ghost btn--sm opacity-40 pointer-events-none">
                  <ChevronLeft size={14} /> Prev
                </span>
              )}
              {currentPage < totalPages ? (
                <Link href={`/tape/${decodedAddress}?page=${currentPage + 1}`} className="btn btn--primary btn--sm">
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
      </div>
    </main>
  );
}
