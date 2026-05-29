import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({
    origin: [process.env.FRONTEND_ORIGIN ?? "http://localhost:5173"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
}));

app.get("/healthz", (c) => c.json({
    status: "ok",
    openai_key_set: !!process.env.OPENAI_API_KEY,
}));

const port = Number(process.env.PORT ?? 8080);
console.log(`listening on :${port}`);
export default { fetch: app.fetch, port };