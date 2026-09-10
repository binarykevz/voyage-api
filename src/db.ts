import { createClient, type Client } from "@libsql/client/web";
import type { Bindings } from "./env.d";

const clients = new WeakMap<object, Client>();

export function getDb(env: Bindings): Client {
  const key = { url: env.TURSO_DATABASE_URL }; // cache key
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
