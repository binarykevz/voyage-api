import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../db";
import { uploadToR2, deleteFromR2, resolvePublicUrl } from "../storage";
import { toResponse, type MediaRecord, type MediaType } from "../types";
import type { Bindings } from "../env.d";

type AppEnv = { Bindings: Bindings };

const ALLOWED_IMAGE = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
]);
const ALLOWED_VIDEO = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
]);

function classifyMime(mime: string): MediaType | null {
  if (ALLOWED_IMAGE.has(mime)) return "image";
  if (ALLOWED_VIDEO.has(mime)) return "video";
  return null;
}

const app = new Hono<AppEnv>();

/* ---------------- POST /api/media ---------------- */
app.post("/", async (c) => {
  const env = c.env;
  const body = await c.req.parseBody({ dot: true });

  const file = body["file"];
  if (!file || !(file instanceof File)) {
    return c.json({ error: "file is required" }, 400);
  }

  const title = String(body["title"] || "").trim();
  if (!title) return c.json({ error: "title is required" }, 400);

  const description = body["description"] ? String(body["description"]) : null;
  const country = body["country"] ? String(body["country"]).trim() : null;

  const mediaType = classifyMime(file.type);
  if (!mediaType) {
    return c.json({ error: `Unsupported mime type: ${file.type}` }, 415);
  }

  // Workers body limit: 100 MB (free) / 500 MB (paid).
  // For larger videos, switch to direct-to-R2 uploads via presigned URL.
  if (file.size > 450 * 1024 * 1024) {
    return c.json({ error: "File too large for Workers (max 450MB)" }, 413);
  }

  const id = crypto.randomUUID();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const key = `${mediaType}/${new Date().toISOString().slice(0, 10)}/${id}.${ext}`;

  // Stream file straight to R2 binding
  await uploadToR2(env, {
    key,
    body: file.stream(),
    contentType: file.type,
  });

  const file_url = resolvePublicUrl(env, key);

  const db = getDb(env);
  await db.execute({
    sql: `INSERT INTO media
          (id, title, description, country, file_key, file_url,
           mime_type, size, media_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, title, description, country, key, file_url,
      file.type, file.size, mediaType, Math.floor(Date.now() / 1000),
    ],
  });

  const row = (await db.execute({
    sql: `SELECT * FROM media WHERE id = ?`,
    args: [id],
  })).rows[0] as unknown as MediaRecord;

  return c.json({ success: true, data: toResponse(row) }, 201);
});

/* ---------------- GET /api/media ---------------- */
const listQuery = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
  country: z.string().optional(),
  type:    z.enum(["image", "video"]).optional(),
  search:  z.string().optional(),
});

app.get("/", zValidator("query", listQuery), async (c) => {
  const q = c.req.valid("query");
  const db = getDb(c.env);

  const where: string[] = [];
  const args: (string | number)[] = [];

  if (q.country) { where.push("country = ?"); args.push(q.country); }
  if (q.type)    { where.push("media_type = ?"); args.push(q.type); }
  if (q.search)  {
    where.push("(title LIKE ? OR description LIKE ?)");
    args.push(`%${q.search}%`, `%${q.search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (q.page - 1) * q.limit;

  const [rows, countRes] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM media ${whereSql}
            ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      args: [...args, q.limit, offset],
    }),
    db.execute({
      sql: `SELECT COUNT(*) as n FROM media ${whereSql}`,
      args,
    }),
  ]);

  const total = Number((countRes.rows[0] as any).n);

  return c.json({
    success: true,
    data: (rows.rows as unknown as MediaRecord[]).map(toResponse),
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      pages: Math.ceil(total / q.limit),
    },
  });
});

/* ---------------- GET /api/media/:id ---------------- */
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env);
  const res = await db.execute({ sql: `SELECT * FROM media WHERE id = ?`, args: [id] });
  const row = res.rows[0] as unknown as MediaRecord | undefined;
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true, data: toResponse(row) });
});

/* ---------------- DELETE /api/media/:id ---------------- */
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const env = c.env;
  const db = getDb(env);

  const res = await db.execute({ sql: `SELECT file_key FROM media WHERE id = ?`, args: [id] });
  const row = res.rows[0] as any;
  if (!row) return c.json({ error: "Not found" }, 404);

  await deleteFromR2(env, row.file_key);
  await db.execute({ sql: `DELETE FROM media WHERE id = ?`, args: [id] });

  return c.json({ success: true, id });
});

export default app;
