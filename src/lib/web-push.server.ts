// Web Push sender — VAPID JWT + raw push protocol via fetch.
// Runs on Cloudflare Worker (uses crypto.subtle, no Node deps).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPID_PUBLIC_KEY =
  "BP6wu25SzuyLK2utGuarm25BetdHf_5IYS-5HxKucD0dV9gflbsHdv9jQVuuYT5JP_O9rVrJMUu3t27p7co-Bic";

function b64UrlEncode(input: string | ArrayBuffer | Uint8Array): string {
  let str: string;
  if (typeof input === "string") {
    str = btoa(input);
  } else {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    str = btoa(bin);
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importVapidPrivateKey(): Promise<CryptoKey> {
  const dBytes = b64UrlDecode(process.env.VAPID_PRIVATE_KEY!);
  const pubBytes = b64UrlDecode(VAPID_PUBLIC_KEY); // 0x04 || X || Y (65 bytes)
  const x = b64UrlEncode(pubBytes.slice(1, 33));
  const y = b64UrlEncode(pubBytes.slice(33, 65));
  const d = b64UrlEncode(dBytes);
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x, y, d, ext: true };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function makeVapidJwt(audience: string, subject: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };
  const headerB64 = b64UrlEncode(JSON.stringify(header));
  const payloadB64 = b64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importVapidPrivateKey();
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64UrlEncode(sig)}`;
}

export interface PushPayload {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends a push notification with no payload (browser falls back to default).
 *  We use no-payload pushes to avoid implementing aes128gcm payload encryption,
 *  and pass title/body via tag→IndexedDB in a future iteration. For now the SW
 *  receives an empty push and shows a generic title; for richer messages we
 *  ship the payload encrypted below.
 */
export async function sendPushToSubscriptions(
  subs: PushSubscriptionRow[],
  payload: PushPayload,
  vapidSubject = "mailto:admin@pizzax.app",
): Promise<{ sent: number; failed: number; removedEndpoints: string[] }> {
  let sent = 0;
  let failed = 0;
  const removedEndpoints: string[] = [];

  for (const sub of subs) {
    try {
      const url = new URL(sub.endpoint);
      const audience = `${url.protocol}//${url.host}`;
      const jwt = await makeVapidJwt(audience, vapidSubject);

      const encrypted = await encryptPayload(payload, sub);

      const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          "Content-Length": String(encrypted.byteLength),
          TTL: "60",
          Urgency: "high",
          Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        },
        body: encrypted,
      });

      if (res.status === 201 || res.status === 202 || res.status === 200) {
        sent++;
      } else if (res.status === 404 || res.status === 410) {
        removedEndpoints.push(sub.endpoint);
        failed++;
      } else {
        console.warn("push failed", res.status, await res.text());
        failed++;
      }
    } catch (e) {
      console.warn("push error", e);
      failed++;
    }
  }

  if (removedEndpoints.length) {
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", removedEndpoints);
  }

  return { sent, failed, removedEndpoints };
}

// --- aes128gcm payload encryption (RFC 8291) ---
async function encryptPayload(
  payload: PushPayload,
  sub: PushSubscriptionRow,
): Promise<Uint8Array> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const clientPub = b64UrlDecode(sub.p256dh); // 65 bytes uncompressed
  const authSecret = b64UrlDecode(sub.auth); // 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate ephemeral ECDH keypair
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const ephemeralPubJwk = await crypto.subtle.exportKey("jwk", ephemeral.publicKey);
  const ephemeralPubRaw = new Uint8Array(65);
  ephemeralPubRaw[0] = 0x04;
  ephemeralPubRaw.set(b64UrlDecode(ephemeralPubJwk.x!), 1);
  ephemeralPubRaw.set(b64UrlDecode(ephemeralPubJwk.y!), 33);

  // Import client public key
  const clientPubKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: b64UrlEncode(clientPub.slice(1, 33)),
      y: b64UrlEncode(clientPub.slice(33, 65)),
      ext: true,
    },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPubKey },
      ephemeral.privateKey,
      256,
    ),
  );

  async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
      "raw",
      salt as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm as BufferSource));
  }
  async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
      "raw",
      prk as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const t = new Uint8Array(info.length + 1);
    t.set(info, 0);
    t[info.length] = 0x01;
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, t as BufferSource));
    return sig.slice(0, len);
  }

  // PRK_key = HKDF(auth, ECDH_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...clientPub,
    ...ephemeralPubRaw,
  ]);
  const prkKey = await hkdfExpand(
    await hkdfExtract(authSecret, sharedSecret),
    keyInfo,
    32,
  );

  // Derive CEK and nonce
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const prk = await hkdfExtract(salt, prkKey);
  const cek = await hkdfExpand(prk, cekInfo, 16);
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // Pad: plaintext || 0x02 (delimiter)
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 0x02;

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aesKey,
      padded as BufferSource,
    ),
  );

  // Header: salt(16) || rs(4)=4096 || idlen(1)=65 || keyid(65) || ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  header[16] = (rs >>> 24) & 0xff;
  header[17] = (rs >>> 16) & 0xff;
  header[18] = (rs >>> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = 65;
  header.set(ephemeralPubRaw, 21);

  const out = new Uint8Array(header.length + ciphertext.length);
  out.set(header, 0);
  out.set(ciphertext, header.length);
  return out;
}

/** Resolves target user ids by audience selector. */
export async function resolveTargetUserIds(
  target: "all" | "managers",
): Promise<string[]> {
  if (target === "managers") {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("is_active", true)
      .in("role", ["admin", "super_admin"]);
    return Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
  }
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("is_active", true);
  return Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
}

export async function fetchSubscriptionsForUsers(
  userIds: string[],
): Promise<PushSubscriptionRow[]> {
  if (!userIds.length) return [];
  const { data } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  return (data ?? []) as PushSubscriptionRow[];
}
