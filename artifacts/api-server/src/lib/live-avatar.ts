import { z } from "zod/v4";

const BASE_URL = "https://api.liveavatar.com";
export const SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";
export const SANDBOX_MAX_SECONDS = 60;

export class AvatarProviderError extends Error {
  constructor(public readonly status: number) {
    super(status === 401 || status === 403
      ? "تعذّر التحقق من مفتاح LiveAvatar. راجع إعدادات الخدمة."
      : status === 402
        ? "رصيد LiveAvatar غير كافٍ. يمكنك المتابعة بالصوت أو الكتابة."
        : status === 429
          ? "الخدمة مشغولة أو وصل حسابك إلى حد الجلسات. حاول لاحقًا."
          : "تعذّر الاتصال بمحاور الفيديو. يمكنك المتابعة بالصوت أو الكتابة.");
  }
}

export function isAvatarConfigured() {
  return Boolean(process.env.LIVEAVATAR_API_KEY);
}

export function arePaidAvatarsEnabled() {
  return process.env.LIVEAVATAR_ENABLE_PAID_SESSIONS === "true";
}

async function providerRequest(path: string, body?: unknown, token?: string) {
  const key = process.env.LIVEAVATAR_API_KEY;
  if (!key) throw new AvatarProviderError(503);
  const response = await fetch(`${BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : { "X-API-KEY": key }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(path.endsWith("/start") ? 30000 : 15000),
  });
  if (!response.ok) throw new AvatarProviderError(response.status);
  const envelope = z.object({ data: z.unknown(), code: z.number().optional() }).parse(await response.json());
  return envelope.data;
}

export async function listAvatars() {
  const data = z.object({
    results: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      preview_url: z.string().nullish(),
      status: z.string().optional(),
      is_expired: z.boolean().optional(),
    })),
  }).parse(await providerRequest("/v1/avatars/public?page_size=100"));
  return data.results
    .filter((avatar) => (!avatar.status || avatar.status === "ACTIVE") && !avatar.is_expired)
    .map((avatar) => ({
      id: avatar.id,
      name: avatar.name,
      previewUrl: avatar.preview_url?.startsWith("https://") ? avatar.preview_url : null,
    }));
}

export async function stopAvatarSession(sessionId: string) {
  try {
    await providerRequest("/v1/sessions/stop", { session_id: sessionId, reason: "USER_CLOSED" });
  } catch (error) {
    // A timed-out or already-stopped session is an idempotent stop.
    if (error instanceof AvatarProviderError && (error.status === 404 || error.status === 410)) return;
    throw error;
  }
}

export async function startAvatarSession(avatarId: string, isSandbox: boolean) {
  const credentials = z.object({
    session_id: z.string().uuid(),
    session_token: z.string().min(1),
  }).parse(await providerRequest("/v1/sessions/token", {
    mode: "LITE",
    avatar_id: isSandbox ? SANDBOX_AVATAR_ID : avatarId,
    is_sandbox: isSandbox,
    // VP8 is mandatory in WebRTC and also works in browsers without an H264 decoder.
    video_settings: { quality: "medium", encoding: "VP8" },
  }));
  try {
    const connection = z.object({
      session_id: z.string().uuid(),
      livekit_url: z.string().url(),
      livekit_client_token: z.string().min(1),
      ws_url: z.string().url(),
      max_session_duration: z.number().int().positive().optional(),
    }).parse(await providerRequest("/v1/sessions/start", {}, credentials.session_token));
    return {
      sessionId: connection.session_id,
      livekitUrl: connection.livekit_url,
      livekitToken: connection.livekit_client_token,
      websocketUrl: connection.ws_url,
      isSandbox,
      maxDurationSeconds: Math.min(connection.max_session_duration ?? (isSandbox ? 60 : 1800), isSandbox ? 60 : 1800),
    };
  } catch (error) {
    await stopAvatarSession(credentials.session_id).catch(() => {});
    throw error;
  }
}
