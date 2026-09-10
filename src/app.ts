import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import mediaRoutes from "./routes/media";
import type { Bindings } from "./env.d";

type AppEnv = { Bindings: Bindings };

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", cors());

// Optional API-key middleware
app.use("/api/*", async (c, next) => {
  const { API_KEY } = c.env;
  if (!API_KEY) return next();
  const key = c.req.header("x-api-key");
  if (key === API_KEY) return next();
  return c.json({ error: "Unauthorized" }, 401);
});

app.get("/", (c) => c.json({ name: "media-api", status: "ok" }));
app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/media", mediaRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

export default app;
