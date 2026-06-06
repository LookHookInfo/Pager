import { verifySignature as thirdwebVerifySignature } from "thirdweb/auth";
import { client } from "./web3";

/**
 * Проверяет подпись сообщения для конкретного адреса кошелька.
 */
export async function verifySignature(
  message: string,
  signature: string,
  address: string
): Promise<boolean> {
  try {
    if (!message || !signature || !address) return false;

    const isValid = await thirdwebVerifySignature({
      client,
      message,
      signature,
      address,
    });

    return isValid;
  } catch (error) {
    console.error("❌ [Auth] Signature verification failed:", error);
    return false;
  }
}

/**
 * Генерирует стандартное сообщение для подписи.
 */
export function getAuthMessage(action: string, address: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // ГГГГ-ММ-ДД
  return `Pager Protocol Authorization\n\nAction: ${action}\nWallet: ${address.toLowerCase()}\nDate: ${timestamp}\n\nI confirm this action on Pager.`;
}
