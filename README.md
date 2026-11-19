# PersonalFit 🔥

Web app (PWA) de entrenamiento en casa, hecha para celular.

- 💪 Rutinas sin equipo (HIIT, Fuerza, Core, Express) en 3 niveles, con un plan de 8 semanas
- ✅ Modo entrenamiento con checklist, temporizador por ejercicio, contador de reps, sonidos y vibración
- 🔥 Rachas diarias (domingo = descanso, +1 comodín por semana), XP, niveles y logros
- 🐾 Mascota compañera que te anima y evoluciona con tu nivel
- ⏱️ Contadores: reps, temporizador, cronómetro e intervalos tipo Tabata
- 🥗 Hábitos de alimentación y registro de peso y cintura con gráficas

Los datos se guardan en el celular (localStorage). Desde Progreso puedes exportar un respaldo.

## Usar
Abre `index.html` con cualquier servidor estático (por ejemplo `python3 -m http.server`) o publícalo en GitHub Pages.
En el celular: menú del navegador → "Agregar a pantalla de inicio".

## Notificaciones (Supabase)
- `supabase/functions/sync`: guarda la suscripción push y el estado (racha, último entreno, hora del recordatorio).
- `supabase/functions/notify`: lo ejecuta `pg_cron` cada hora y avisa a quien no ha entrenado a su hora elegida.
- Tabla `public.push_subs` con RLS activado (solo accede la service role desde las funciones).
- Secretos de las funciones: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
