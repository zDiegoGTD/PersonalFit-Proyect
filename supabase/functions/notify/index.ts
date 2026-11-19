// Se ejecuta cada hora (pg_cron). Avisa a quien no ha entrenado hoy a su hora elegida.
import { db, send, localNow, message, type Sub } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const { data, error } = await db.from("push_subs").select("*").eq("enabled", true);
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0, removed = 0;
  for (const s of (data ?? []) as Sub[]) {
    const now = localNow(s.tz);
    if (now.hour !== s.remind_hour) continue;
    if (now.weekday === "Sun") continue;               // domingo = descanso
    if (s.last_workout === now.date || s.skip_date === now.date || s.last_sent === now.date) continue;
    const m = message(s, now.date);
    if (await send(s, m.title, m.body)) {
      sent++;
      await db.from("push_subs").update({ last_sent: now.date }).eq("device_id", s.device_id);
    } else {
      removed++;
      await db.from("push_subs").delete().eq("device_id", s.device_id);
    }
  }
  return Response.json({ sent, removed });
});
