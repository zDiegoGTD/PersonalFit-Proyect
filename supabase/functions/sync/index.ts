// Recibe la suscripción push y el estado (racha, último entreno, hora del recordatorio) desde la app.
import { db, send, localNow, message, type Sub } from "../_shared/push.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: Record<string, any>;
  try { b = await req.json(); } catch { return json({ error: "json" }, 400); }
  if (!UUID.test(b.device_id ?? "")) return json({ error: "device_id" }, 400);

  const row: Record<string, unknown> = { device_id: b.device_id, updated_at: new Date().toISOString() };
  if (b.subscription) {
    const s = b.subscription;
    if (typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://") || !s.keys?.p256dh || !s.keys?.auth) return json({ error: "subscription" }, 400);
    Object.assign(row, { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth });
  }
  if (Number.isInteger(b.remind_hour) && b.remind_hour >= 0 && b.remind_hour <= 23) row.remind_hour = b.remind_hour;
  if (typeof b.tz === "string" && b.tz.length < 64) row.tz = b.tz;
  if (b.last_workout === null || DATE.test(b.last_workout ?? "")) row.last_workout = b.last_workout ?? null;
  if (b.skip_date === null || DATE.test(b.skip_date ?? "")) row.skip_date = b.skip_date ?? null;
  if (Number.isInteger(b.streak) && b.streak >= 0) row.streak = b.streak;
  if (typeof b.pet_name === "string") row.pet_name = b.pet_name.slice(0, 16);
  if (typeof b.enabled === "boolean") row.enabled = b.enabled;

  if (b.subscription) {
    const { error } = await db.from("push_subs").upsert(row);
    if (error) return json({ error: error.message }, 500);
  } else {
    const { error } = await db.from("push_subs").update(row).eq("device_id", b.device_id);
    if (error) return json({ error: error.message }, 500);
  }

  if (b.test) {
    const { data } = await db.from("push_subs").select("*").eq("device_id", b.device_id).single();
    if (!data) return json({ error: "not subscribed" }, 404);
    const sub = data as Sub;
    const m = message(sub, localNow(sub.tz).date);
    const ok = await send(sub, m.title, m.body);
    return json({ ok, sent: true });
  }
  return json({ ok: true });
});
