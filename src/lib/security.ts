import crypto from 'crypto';
import type { Profile } from '@/types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Для GCM рекомендуется 12 байт
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // 32 байта в hex

/**
 * Шифрует текст с использованием AES-256-GCM
 */
export function encryptData(text: string): string {
  if (!text) return '';
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 64) {
    throw new Error('Missing or invalid ENCRYPTION_KEY in environment');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Возвращаем iv + authTag + encrypted в одной строке
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Дешифрует текст, зашифрованный функцией encryptData
 */
export function decryptData(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData; // Возможно, это не зашифрованные данные
  
  try {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ [Security] Decryption failed:', error);
    throw new Error('Decryption failed — corrupted data or invalid key');
  }
}

/**
 * Маскирует чувствительный ключ для отображения в UI
 */
export function maskKey(key: string): string {
  if (!key || key.length < 8) return '********';
  // Если ключ уже зашифрован (содержит двоеточия), маскируем его полностью
  if (key.includes(':')) return '••••••••••••••••';
  
  const start = key.slice(0, 6);
  const end = key.slice(-4);
  return `${start}...${end}`;
}

/**
 * Проверяет, является ли строка зашифрованной
 */
export function isEncrypted(data: string): boolean {
  return typeof data === 'string' && data.split(':').length === 3;
}

/**
 * Маскирует числовой chat ID Telegram (или @username без изменений).
 * Используется и на сервере, и в клиентском UI.
 */
export function maskChatId(id: string | undefined | null): string {
  if (!id) return "";
  if (id.startsWith('-100')) return '-100' + '•'.repeat(Math.max(0, id.length - 7)) + id.slice(-3);
  if (id.startsWith('-')) return '-' + '•'.repeat(Math.max(0, id.length - 4)) + id.slice(-3);
  return id;
}

export interface SanitizeOptions {
  /** Маскировать также telegram chatId и URL CTA-ссылок (для публичных API-ответов). */
  maskChannels?: boolean;
}

/**
 * Единая функция маскирования профиля перед отправкой на фронтенд.
 * Всегда маскирует API-ключи; chat ID и CTA-ссылки — по опции maskChannels.
 */
export function sanitizeProfile(profile: Profile, options?: SanitizeOptions): Profile {
  const { maskChannels = false } = options || {};

  const safeChannels = maskChannels
    ? (profile.telegram_channels || []).map((ch) => ({
        ...ch,
        chatId: ch.chatId?.startsWith('-') ? maskChatId(ch.chatId) : ch.chatId,
      }))
    : profile.telegram_channels;

  const safeCta = maskChannels
    ? (profile.cta_links || []).map((link) => ({
        ...link,
        url: link.url?.includes('t.me/') && link.url.match(/\/-?\d+/) ? link.url.replace(/\/-?\d+/, '/' + maskChatId(link.url.match(/\/-?\d+/)![0].slice(1))) : link.url,
      }))
    : profile.cta_links;

  return {
    ...profile,
    ai_credits: profile.ai_credits || 0,
    ai_api_key: profile.ai_api_key ? maskKey(profile.ai_api_key) : "",
    binance_accounts: (profile.binance_accounts || []).map((acc) => ({
      ...acc,
      apiKey: acc.apiKey ? maskKey(acc.apiKey) : "",
    })),
    telegram_channels: safeChannels,
    cta_links: safeCta,
  };
}
