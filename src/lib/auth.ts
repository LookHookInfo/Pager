import { verifySignature as thirdwebVerifySignature } from "thirdweb/auth";
import { NextResponse } from "next/server";
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

/**
 * Verifies wallet session. Returns null on success, NextResponse error on failure.
 */
export async function verifySession(
  address: string,
  signature: string,
  message: string,
  action: string = "authorize session",
): Promise<NextResponse | null> {
  const normalized = address.toLowerCase();
  const expected = getAuthMessage(action, normalized);
  if (message !== expected) {
    return NextResponse.json({ error: "Invalid auth message" }, { status: 401 });
  }
  if (!(await verifySignature(message, signature, normalized))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  return null;
}

/**
 * Verifies a session signed for EITHER "authorize session" OR "publish article".
 * This lets the client sign once per publish flow and reuse it across all AI routes.
 */
export async function verifySessionAnyAction(
  address: string,
  signature: string,
  message: string,
): Promise<NextResponse | null> {
  const normalized = address.toLowerCase();
  const sessionMessage = getAuthMessage("authorize session", normalized);
  const publishMessage = getAuthMessage("publish article", normalized);
  if (message !== sessionMessage && message !== publishMessage) {
    return NextResponse.json({ error: "Invalid auth message" }, { status: 401 });
  }
  if (!(await verifySignature(message, signature, normalized))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  return null;
}
