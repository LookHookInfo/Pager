import 'dotenv/config';
import axios from 'axios';
import { Telegraf } from 'telegraf';
import cron from 'node-cron';
import { readFile, writeFile } from 'fs/promises';
import { HttpsProxyAgent } from 'https-proxy-agent';
import Parser from 'rss-parser';
import { TwitterApi } from 'twitter-api-v2';

// ==========================================================================
// КРИТИЧЕСКИ ВАЖНО: НИКОГДА НЕ УДАЛЯТЬ ИНФОРМАЦИЮ О СПОНСОРЕ (SPONSOR_URL)
// 💎 Sponsor: https://hashcoin.farm/ - ЭТО ПРИОРИТЕТ №1 ДЛЯ ВСЕХ ПОСТОВ!
// ==========================================================================

const {
  OPENROUTER_API_KEY,
  TELEGRAM_BOT_TOKEN,
  NEWSDATA_API_KEY,
  SPONSOR_URL = 'https://hashcoin.farm/',
  NEWS_LANGUAGE = 'ru',
  CHECK_INTERVAL_MINUTES = 30,
  PROXY_HOST,
  PROXY_PORT,
  PROXY_USER,
  PROXY_PASS,
  LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_PERSON_ID,
  SQUARE_API_KEY,
  SQUARE_API_KEY_EN_MARGO,
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
  SITE_API_KEY,
  NEXT_PUBLIC_SITE_URL
} = process.env;

const TG_CHATS = [];
for (let i = 1; i <= 10; i++) {
  const id = process.env[`TELEGRAM_CHAT_${i}_ID`];
  if (id) {
    TG_CHATS.push({ id, topic: process.env[`TELEGRAM_CHAT_${i}_TOPIC`] || null });
  }
}

const PLATFORMS = {
  TELEGRAM: !!TELEGRAM_BOT_TOKEN && TG_CHATS.length > 0,
  SQUARE: !!SQUARE_API_KEY,
  LINKEDIN: !!LINKEDIN_ACCESS_TOKEN,
  TWITTER: !!TWITTER_ACCESS_TOKEN
};

const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
const proxyAgent = new HttpsProxyAgent(proxyUrl);

const parser = new Parser({
  customFields: { item: [['media:content', 'mediaContent', { keepArray: false }]] },
  headers: { 'User-Agent': 'Mozilla/5.0' },
  requestOptions: { agent: proxyAgent, timeout: 15000 }
});

const bot = PLATFORMS.TELEGRAM ? new Telegraf(TELEGRAM_BOT_TOKEN, { telegram: { agent: proxyAgent } }) : null;

let twitterClient = null;
if (PLATFORMS.TWITTER) {
  try {
    twitterClient = new TwitterApi({
      appKey: TWITTER_CONSUMER_KEY,
      appSecret: TWITTER_CONSUMER_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_SECRET,
    });
  } catch (e) { console.error('❌ Twitter Init Error:', e.message); }
}

const DB_FILE = 'last_news.json';
const axiosConfig = { httpsAgent: proxyAgent, proxy: false, timeout: 30000 };
const api = axios.create(axiosConfig);

let globalPersonUrn = null;

async function checkProxy() {
  try {
    await axios.get('https://www.google.com', { httpsAgent: proxyAgent, timeout: 10000 });
    return true;
  } catch (e) { return false; }
}

async function loadPostedIds() {
  try { return JSON.parse(await readFile(DB_FILE, 'utf-8')); } catch (e) { return []; }
}

async function savePostedId(id) {
  const ids = await loadPostedIds();
  const sId = String(id);
  if (!ids.includes(sId)) {
    ids.push(sId);
    await writeFile(DB_FILE, JSON.stringify(ids.slice(-500), null, 2));
  }
}

async function getLinkedInMe() {
  if (!PLATFORMS.LINKEDIN) return null;
  try {
    const res = await api.get('https://api.linkedin.com/v2/userinfo', { headers: { 'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`, 'X-Restli-Protocol-Version': '2.0.0' } });
    globalPersonUrn = `urn:li:person:${res.data.sub || res.data.id}`;
    return globalPersonUrn;
  } catch (e) {
    if (LINKEDIN_PERSON_ID) globalPersonUrn = LINKEDIN_PERSON_ID.startsWith('urn:') ? LINKEDIN_PERSON_ID : `urn:li:person:${LINKEDIN_PERSON_ID}`;
    return globalPersonUrn;
  }
}

async function getHashPrice() {
  try {
    const res = await axios.get('https://api.dexscreener.com/latest/dex/pairs/base/0x272ebdef2a48efba45135b9db30fc8d8e51e4bbeb47ba287e8754f1c3f9f4534', { timeout: 10000 });
    return res.data.pair?.priceUsd ? `$${res.data.pair.priceUsd}` : '';
  } catch (e) { return ''; }
}

async function getHashStats() {
  try {
    const res = await axios.get('https://api.dexscreener.com/latest/dex/pairs/base/0x272ebdef2a48efba45135b9db30fc8d8e51e4bbeb47ba287e8754f1c3f9f4534', { timeout: 10000 });
    return res.data.pair;
  } catch (e) { return null; }
}

async function postToTwitter(text) {
  if (!PLATFORMS.TWITTER || !twitterClient) return { success: false };
  try { await twitterClient.v2.tweet(text); return { success: true }; } catch (e) { return { success: false, error: e.message }; }
}

async function postToLinkedIn(text, imageUrl = null) {
  if (!PLATFORMS.LINKEDIN || !globalPersonUrn) return { success: false };
  let imageAsset = null;
  if (imageUrl?.startsWith('http')) {
    try {
      const regRes = await api.post("https://api.linkedin.com/v2/images?action=initializeUpload", { "initializeUploadRequest": { "owner": globalPersonUrn } }, { headers: { 'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`, 'X-Restli-Protocol-Version': '2.0.0' } });
      const { uploadUrl, image } = regRes.data.value;
      const imgBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer', httpsAgent: proxyAgent, timeout: 15000 });
      await axios.put(uploadUrl, imgBuffer.data, { headers: { 'Content-Type': 'application/octet-stream' }, httpsAgent: proxyAgent });
      imageAsset = image;
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {}
  }
  try {
    const payload = { "author": globalPersonUrn, "commentary": text, "visibility": "PUBLIC", "distribution": { "feedDistribution": "MAIN_FEED" }, "lifecycleState": "PUBLISHED" };
    if (imageAsset) payload.content = { "media": { "id": imageAsset } };
    await api.post("https://api.linkedin.com/v2/posts", payload, { headers: { 'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`, 'X-Restli-Protocol-Version': '2.0.0', 'LinkedIn-Version': '202401' } });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

async function postToSquare(text, imageUrl = null, apiKey = SQUARE_API_KEY) {
  if (!apiKey) return { success: false };
  const url = "https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add";
  const payload = { "bodyTextOnly": text, "type": 1, "articleType": 1 };
  if (imageUrl?.startsWith('http')) { payload.picUrlList = [imageUrl]; payload.picUrls = [imageUrl]; }
  try {
    const res = await api.post(url, payload, { headers: { "X-Square-OpenAPI-Key": apiKey, "clienttype": "binanceSkill" } });
    return res.data.success || res.data.code === '000000' ? { success: true } : { success: false, error: JSON.stringify(res.data) };
  } catch (e) { return { success: false, error: e.message }; }
}

async function postToSite(title, content, imageUrl, sourceUrl, lang = 'ru') {
  if (!SITE_API_KEY || !NEXT_PUBLIC_SITE_URL) return null;
  try {
    const res = await axios.post(`${NEXT_PUBLIC_SITE_URL}/api/article`, { title, content, imageUrl, sourceUrl, lang }, { headers: { 'x-api-key': SITE_API_KEY }, timeout: 15000 });
    return res.data.success ? res.data.url : null;
  } catch (e) { return null; }
}

async function scrapeUrlContent(url) {
  try {
    const response = await axios.get(url, { httpsAgent: proxyAgent, headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
    const html = response.data;
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
    const image = html.match(/property="og:image" content="(.*?)"/i)?.[1] || html.match(/name="twitter:image" content="(.*?)"/i)?.[1] || null;
    const description = html.match(/property="og:description" content="(.*?)"/i)?.[1] || html.match(/name="description" content="(.*?)"/i)?.[1] || "";
    return { title, description, image, url };
  } catch (e) { return { url }; }
}

async function aiSelectBestNews(candidates) {
  if (candidates.length === 0) return null;
  const titlesList = candidates.map((c, i) => `${i}. ${c.title}`).join('\n');
  const prompt = `Select ONE most impactful crypto news. Return JSON: {"index": 0, "reason": "..."}`;
  try {
    const res = await api.post('https://openrouter.ai/api/v1/chat/completions', { model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: prompt + '\n\n' + titlesList }], response_format: { type: "json_object" } }, { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` } });
    const selection = JSON.parse(res.data.choices[0].message.content);
    return candidates[selection.index] || candidates[0];
  } catch (e) { return candidates[0]; }
}

async function rewriteContent(content, isManual = false) {
  const style = isManual ? "НАШ собственный контент. Пиши гордо и харизматично." : "Новость крипты. Острый хайповый рерайт.";
  const prompt = `Ты харизматичный крипто-блогер. Сделай рерайт на ДВУХ языках.
  МАТЕРИАЛ: ${content.title}. Суть: ${content.description}. ЗАДАЧА: ${style}
  ФОРМАТ JSON: { "tg": "текст на русском", "square": "текст на русском", "square_en": "sharp viral text in English", "linkedin": "текст на русском", "twitter": "краткий текст до 250 симв" }`;
  try {
    const res = await api.post('https://openrouter.ai/api/v1/chat/completions', { model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: "json_object" } }, { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` } });
    return JSON.parse(res.data.choices[0].message.content);
  } catch (e) { return null; }
}

async function generateReport(stats) {
  const prompt = `Напиши аналитический пост о токене $HASH. Цена: $${stats.priceUsd}, 24ч: ${stats.priceChange.h24}%, Ликвидность: $${Math.round(stats.liquidity.usd)}, Капа: $${Math.round(stats.fdv)}.
  ФОРМАТ JSON: {"tg": "...", "square": "...", "linkedin": "...", "square_en": "English analysis"}`;
  try {
    const res = await api.post('https://openrouter.ai/api/v1/chat/completions', { model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: "json_object" } }, { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` } });
    return JSON.parse(res.data.choices[0].message.content);
  } catch (e) { return null; }
}

function escapeHTML(text) { return text?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || ''; }

async function multiPublish(texts, imageUrl, sourceUrl, isManual = false) {
  const price = await getHashPrice();
  const priceLine = price ? ` (Price: ${price})` : '';
  
  const sponsorLineRu = `\n\n💎 Спонсор: ${SPONSOR_URL}${priceLine}`;
  const sourceLineRu = (url) => `\n🔗 Источник: ${url}`;
  const sponsorLineEn = `\n\n💎 Sponsor: ${SPONSOR_URL}${priceLine}`;
  const sourceLineEn = (url) => `\n🔗 Source: ${url}`;

  const tasks = [];
  const siteTask = postToSite(texts.tg || texts.square, texts.tg || texts.square, imageUrl, sourceUrl, 'ru');

  if (PLATFORMS.TELEGRAM) {
    for (const chat of TG_CHATS) {
      tasks.push((async () => {
        try {
          const siteUrl = await siteTask;
          const finalSourceUrl = siteUrl || sourceUrl;
          const tgMsg = `<b>${escapeHTML(texts.tg || texts.square)}</b>\n\n🔗 <a href="${finalSourceUrl}">${siteUrl ? 'Читать на сайте' : 'Источник'}</a>\n💎 <a href="${SPONSOR_URL}">HashCoin Farm</a>${priceLine}`;
          const options = { parse_mode: 'HTML' };
          if (chat.topic) options.message_thread_id = chat.topic;
          if (imageUrl?.startsWith('http')) await bot.telegram.sendPhoto(chat.id, imageUrl, { caption: tgMsg, ...options }).catch(() => bot.telegram.sendMessage(chat.id, tgMsg, options));
          else await bot.telegram.sendMessage(chat.id, tgMsg, options);
        } catch (e) {}
      })());
    }
  }
  if (PLATFORMS.SQUARE && (texts.square || texts.tg)) {
    tasks.push((async () => {
      const siteUrl = await siteTask;
      const res = await postToSquare(`${texts.square || texts.tg}${sourceLineRu(siteUrl || sourceUrl)}${sponsorLineRu}`, imageUrl, SQUARE_API_KEY);
      console.log(`[SQUARE RU] ${res.success ? '✅' : '❌'}`);
    })());
  }
  if (PLATFORMS.LINKEDIN && (texts.linkedin || texts.tg)) {
    tasks.push((async () => {
      const siteUrl = await siteTask;
      const res = await postToLinkedIn(`${texts.linkedin || texts.tg}${sourceLineRu(siteUrl || sourceUrl)}${sponsorLineRu}`, imageUrl);
      console.log(`[LINKEDIN RU] ${res.success ? '✅' : '❌'}`);
    })());
  }
  if (PLATFORMS.TWITTER && (texts.twitter || texts.tg)) {
    tasks.push((async () => {
       const siteUrl = await siteTask;
       const res = await postToTwitter(`${texts.twitter || texts.tg}`.slice(0, 240) + `\n${sourceLineRu(siteUrl || sourceUrl)}\n${SPONSOR_URL}`);
       console.log(`[X RU] ${res.success ? '✅' : '❌'}`);
    })());
  }
  if (SQUARE_API_KEY_EN_MARGO && texts.square_en) {
    tasks.push((async () => {
      const siteUrl = await siteTask;
      const res = await postToSquare(`${texts.square_en}${sourceLineEn(siteUrl || sourceUrl)}${sponsorLineEn}`, imageUrl, SQUARE_API_KEY_EN_MARGO);
      console.log(`[SQUARE EN] ${res.success ? '✅' : '❌'}`);
    })());
  }
  await Promise.allSettled(tasks);
}

let isProcessing = false;
async function processNews() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const news = [];
    const feeds = [{ name: 'NewsData', url: `https://newsdata.io/api/1/crypto?apikey=${NEWSDATA_API_KEY}&language=${NEWS_LANGUAGE}` }, { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' }, { name: 'CryptoPanic', url: 'https://cryptopanic.com/news/rss/' }];
    for (const f of feeds) {
      try {
        if (f.name === 'NewsData') {
          const res = await axios.get(f.url, { timeout: 20000 });
          if (res.data.results) news.push(...res.data.results.map(a => ({ article_id: a.article_id, title: a.title, description: a.description, link: a.link, image_url: a.image_url })));
        } else {
          const res = await axios.get(f.url, { httpsAgent: proxyAgent, timeout: 20000 });
          const parsed = await parser.parseString(res.data);
          news.push(...parsed.items.map(i => ({ article_id: i.guid || i.link, title: i.title, description: i.contentSnippet, link: i.link, image_url: i.enclosure?.url || i.mediaContent?.url || null })));
        }
      } catch (e) {}
    }
    const posted = await loadPostedIds();
    const fresh = news.filter(a => !posted.includes(String(a.article_id)));
    if (fresh.length > 0) {
      const article = await aiSelectBestNews(fresh.slice(0, 30));
      if (article) {
        await savePostedId(article.article_id);
        const content = await scrapeUrlContent(article.link);
        if (!content.image && article.image_url) content.image = article.image_url;
        if (!content.description) content.description = article.description;
        const texts = await rewriteContent(content, false);
        if (texts) await multiPublish(texts, content.image, article.link, false);
      }
    }
  } catch (e) { console.error(e); } finally { isProcessing = false; }
}

const command = process.argv[2];
(async () => {
  if (!(await checkProxy())) { console.error('❌ Прокси не работает'); return; }
  await getLinkedInMe();
  if (command === 'report') {
    const stats = await getHashStats();
    if (stats) { const texts = await generateReport(stats); if (texts) await multiPublish(texts, null, stats.url, true); }
  } else if (command?.startsWith('http')) {
    const content = await scrapeUrlContent(command);
    if (content?.title) { const texts = await rewriteContent(content, true); if (texts) await multiPublish(texts, content.image, command, true); }
  } else {
    cron.schedule(`*/${CHECK_INTERVAL_MINUTES} * * * *`, processNews);
    processNews(); 
  }
})();
