import type { Bindings } from "./env.d";

export type UploadInput = {
  key: string;
  body: ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array | string;
  contentType: string;
};

export async function uploadToR2(env: Bindings, input: UploadInput) {
  await env.MY_BUCKET.put(input.key, input.body as any, {
    httpMetadata: { contentType: input.contentType },
  });
}

export async function deleteFromR2(env: Bindings, key: string) {
  await env.MY_BUCKET.delete(key);
}

export function resolvePublicUrl(env: Bindings, key: string): string {
  if (env.PUBLIC_MEDIA_URL) {
    return `${env.PUBLIC_MEDIA_URL.replace(/\/$/, "")}/${encodeURIComponent(key)}`;
  }
  // Fallback: use R2 dev URL (only works in dev / with public bucket)
  // In production, set PUBLIC_MEDIA_URL or use a custom domain.
  return key;
}
