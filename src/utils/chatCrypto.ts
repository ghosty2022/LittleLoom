import * as SecureStore from 'expo-secure-store';
import { x25519 } from '@noble/curves/ed25519';
import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/hashes/utils';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';
import { supabase } from './supabase';

const PRIV_KEY_PREFIX = 'e2ee_priv_';

const toB64 = (u8: Uint8Array) =>
  typeof Buffer !== 'undefined'
    ? Buffer.from(u8).toString('base64')
    : btoa(String.fromCharCode(...u8));
const fromB64 = (s: string) =>
  typeof Buffer !== 'undefined'
    ? new Uint8Array(Buffer.from(s, 'base64'))
    : new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));

/** Ensure this user has a long-term X25519 keypair on this device. */
export async function ensureIdentityKey(userId: string): Promise<{
  publicKeyB64: string;
  privateKey: Uint8Array;
}> {
  const storeKey = `${PRIV_KEY_PREFIX}${userId}`;
  const existing = await SecureStore.getItemAsync(storeKey);
  if (existing) {
    const { priv, pub } = JSON.parse(existing);
    return { publicKeyB64: pub, privateKey: fromB64(priv) };
  }
  const priv = x25519.utils.randomPrivateKey();
  const pub = x25519.getPublicKey(priv);
  const pubB64 = toB64(pub);
  const privB64 = toB64(priv);
  await SecureStore.setItemAsync(
    storeKey,
    JSON.stringify({ priv: privB64, pub: pubB64 }),
  );
  // Publish public key so peers can wrap the chat key to us.
  await supabase
    .from('profiles')
    .update({ public_key: pubB64 })
    .eq('id', userId);
  return { publicKeyB64: pubB64, privateKey: priv };
}

/** Get or create the symmetric key for a chat. */
export async function getChatSymmetricKey(
  chatId: string,
  userId: string,
): Promise<Uint8Array | null> {
  // Try local cache.
  const cacheKey = `e2ee_chat_${chatId}_${userId}`;
  const cached = await SecureStore.getItemAsync(cacheKey);
  if (cached) return fromB64(cached);

  // Look for a wrapped key for me.
  const { data: row } = await supabase
    .from('chat_keys')
    .select('wrapped_key, ephemeral_pub')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!row) return null;

  const { privateKey } = await ensureIdentityKey(userId);
  const ephemeralPub = fromB64(row.ephemeral_pub);
  const wrapped = fromB64(row.wrapped_key);
  // X25519 ECDH → shared secret
  const shared = x25519.getSharedSecret(privateKey, ephemeralPub);
  // Use the first 32 bytes as AES key, take nonce from remaining
  const key = shared.slice(0, 32);
  const nonce = wrapped.slice(0, 12);
  const ciphertext = wrapped.slice(12);
  const aes = gcm(key, nonce);
  const symmetric = aes.decrypt(ciphertext);
  await SecureStore.setItemAsync(cacheKey, toB64(symmetric));
  return symmetric;
}

/** Wrap a freshly-created symmetric key for each recipient. */
export async function distributeChatKey(
  chatId: string,
  symmetricKey: Uint8Array,
  recipientPublicKeys: { userId: string; publicKeyB64: string }[],
) {
  for (const r of recipientPublicKeys) {
    const ephPriv = x25519.utils.randomPrivateKey();
    const ephPub = x25519.getPublicKey(ephPriv);
    const shared = x25519.getSharedSecret(
      ephPriv,
      fromB64(r.publicKeyB64),
    );
    const key = shared.slice(0, 32);
    const nonce = randomBytes(12);
    const aes = gcm(key, nonce);
    const ciphertext = aes.encrypt(symmetricKey);
    const wrapped = new Uint8Array(nonce.length + ciphertext.length);
    wrapped.set(nonce, 0);
    wrapped.set(ciphertext, nonce.length);
    await supabase.from('chat_keys').upsert({
      chat_id: chatId,
      user_id: r.userId,
      wrapped_key: toB64(wrapped),
      ephemeral_pub: toB64(ephPub),
    });
  }
}

export function encryptText(symmetricKey: Uint8Array, plaintext: string) {
  const nonce = randomBytes(12);
  const aes = gcm(symmetricKey, nonce);
  const ciphertext = aes.encrypt(utf8ToBytes(plaintext));
  return `enc:v1:${toB64(nonce)}:${toB64(ciphertext)}`;
}

export function decryptText(symmetricKey: Uint8Array, payload: string) {
  if (!payload.startsWith('enc:v1:')) return payload;
  const [, , nonceB64, ctB64] = payload.split(':');
  const nonce = fromB64(nonceB64);
  const ct = fromB64(ctB64);
  const aes = gcm(symmetricKey, nonce);
  return bytesToUtf8(aes.decrypt(ct));
}