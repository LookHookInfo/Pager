import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Для GCM рекомендуется 12 байт
const AUTH_TAG_LENGTH = 16;
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
