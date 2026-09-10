import { createClient, type Client } from "@libsql/client/web";
import type { Bindings } from "./env.d";

const clients = new WeakMap<object, Client>();

export function getDb(env: Bindings): Client {
  // 👇 Add this defensive check
  if (!env.TURSO_AUTH_TOKEN) {
    throw new Error("Missing TURSO_AUTH_TOKEN. Run: npx wrangler secret put TURSO_AUTH_TOKEN");
  }

  const key = { url: env.TURSO_DATABASE_URL };
  let client = clients.get(key);
  if (!client) {
    client = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
    clients.set(key, client);
  }
  return client;
}
