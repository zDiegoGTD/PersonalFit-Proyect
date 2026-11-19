// Respaldo automático del progreso. El device_id (UUID aleatorio) funciona como código secreto de recuperación.
import { db } from "../_shared/push.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  if (raw.length > 1_000_000) return json({ error: "too big" }, 413);
  let b: Record<string, any>;
  try { b = JSON.parse(raw); } catch { return json({ error: "json" }, 400); }
  const id = String(b.device_id ?? "").toLowerCase();
  if (!UUID.test(id)) return json({ error: "code" }, 400);

  if (b.restore) {
    const { data } = await db.from("backups").select("data, updated_at").eq("device_id", id).maybeSingle();
    return data ? json(data) : json({ error: "not found" }, 404);
  }
  if (!b.data || typeof b.data !== "object" || !b.data.pet || !b.data.days) return json({ error: "data" }, 400);
  const { error } = await db.from("backups").upsert({ device_id: id, data: b.data, updated_at: new Date().toISOString() });
  return error ? json({ error: error.message }, 500) : json({ ok: true });
});
