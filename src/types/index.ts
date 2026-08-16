export interface BinanceAccount {
  label: string;
  apiKey: string;
  language?: string;
  style?: string;
}

export interface TelegramChannel {
  label: string;
  chatId: string;
  topicId?: string;
  language?: string;
  style?: string;
}

export interface CtaLink {
  label: string;
  url: string;
}

export interface RefLink {
  label: string;
  url: string;
}

export interface Profile {
  address: string;
  name?: string | null;
  bio?: string | null;
  website?: string | null;
  avatar_url?: string | null;
  cmc_username?: string | null;
  gemfun_token?: string | null;
  twitter?: string | null;
  ai_api_key?: string | null;
  ai_credits?: number | null;
  ai_nft_token_id?: string | null;
  binance_accounts?: BinanceAccount[];
  telegram_channels?: TelegramChannel[];
  telegram_chat_id?: string | null;
  cta_links?: CtaLink[];
  ref_links?: RefLink[];
  created_at?: string;
}
