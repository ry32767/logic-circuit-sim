import type { Circuit } from '../../types/circuit';
import { parseCircuit, serializeCircuit } from './json';

// URL ハッシュに回路を埋め込むためのキー（例: #c=...）
const HASH_KEY = 'c';

// バイト列を URL セーフな Base64 に変換する
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// URL セーフな Base64 をバイト列へ戻す
function base64UrlToBytes(input: string): Uint8Array {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 回路を URL セーフな Base64 文字列にエンコードする
export function encodeCircuit(circuit: Circuit): string {
  const json = serializeCircuit(circuit);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

// Base64 文字列を回路へデコードする（スキーマ検証込み・不正なら例外）
export function decodeCircuit(encoded: string): Circuit {
  const bytes = base64UrlToBytes(encoded);
  const json = new TextDecoder().decode(bytes);
  return parseCircuit(json);
}

// 共有用 URL を組み立てる（GitHub Pages のルーティングに影響しないよう hash を使う）
export function buildShareUrl(circuit: Circuit): string {
  const encoded = encodeCircuit(circuit);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${HASH_KEY}=${encoded}`;
}

// 現在の URL ハッシュから回路を読み取る（無ければ null、不正でも null）
export function readCircuitFromUrl(): Circuit | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const encoded = params.get(HASH_KEY);
  if (!encoded) return null;
  try {
    return decodeCircuit(encoded);
  } catch {
    return null;
  }
}

// 共有後に URL のハッシュを現在の回路で更新する
export function updateUrlHash(circuit: Circuit): void {
  const encoded = encodeCircuit(circuit);
  window.history.replaceState(null, '', `#${HASH_KEY}=${encoded}`);
}
