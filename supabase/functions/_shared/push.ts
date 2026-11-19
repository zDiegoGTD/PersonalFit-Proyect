import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type Sub = {
  device_id: string; endpoint: string; p256dh: string; auth: string;
  remind_hour: number; tz: string; last_workout: string | null; streak: number;
  pet_name: string | null; skip_date: string | null; last_sent: string | null; enabled: boolean;
};

/** Envía una notificación. Devuelve false si la suscripción ya no existe. */
export async function send(s: Sub, title: string, body: string): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title, body, url: "./" }),
      { TTL: 60 * 60 * 6, urgency: "high" },
    );
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return false;
    console.error("push error", code, e);
    return true;
  }
}

/** Fecha (YYYY-MM-DD), hora y día de la semana locales en la zona horaria del usuario. */
export function localNow(tz: string) {
  const d = new Date();
  let zone = tz;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch { zone = "UTC"; }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday as string };
}

export function message(s: Sub, today: string) {
  const pet = s.pet_name || "Tu mascota";
  const daysOff = s.last_workout ? Math.round((Date.parse(today) - Date.parse(s.last_workout)) / 864e5) : 99;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  if (s.streak > 0 && daysOff <= 1) {
    return { title: `🔥 ¡Racha de ${s.streak} ${s.streak === 1 ? "día" : "días"} en juego!`,
      body: pick([`${pet} te espera para entrenar y no perder la racha 💪`, `No dejes que se apague el fuego. ¡Solo unos minutos hoy!`, `${pet} ya se puso los tenis 👟 ¿Vamos?`]) };
  }
  if (daysOff >= 3 && daysOff < 99) {
    return { title: `😿 ${pet} te extraña`, body: `Llevas ${daysOff} días sin entrenar. Hoy es buen día para volver, aunque sea el Express de 10 min.` };
  }
  return { title: `🐾 ¡Hora de entrenar!`, body: pick([`${pet} está lista para empezar. ¡Tú puedes!`, `Tu yo del futuro te lo va a agradecer 💪`, `Un entreno corto es mejor que ninguno. ¡Vamos!`]) };
}
