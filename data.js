// Biblioteca de ejercicios (sin equipo)
const EXERCISES = {
  jumping:  {n:'Jumping jacks', e:'⭐', d:'Salta abriendo piernas y brazos a la vez. Aterriza suave.'},
  squat:    {n:'Sentadillas', e:'🦵', d:'Pies al ancho de hombros, baja la cadera atrás como si te sentaras. Rodillas siguiendo la punta de los pies, espalda recta.'},
  pushup:   {n:'Flexiones', e:'💪', d:'Manos bajo los hombros, cuerpo en línea recta. Si cuesta, apoya las rodillas.'},
  plank:    {n:'Plancha', e:'🧱', d:'Antebrazos en el suelo, cuerpo recto de cabeza a talones. Aprieta abdomen y glúteos.'},
  burpee:   {n:'Burpees', e:'🔥', d:'Baja a cuclillas, lleva los pies atrás a plancha, regresa y salta con brazos arriba.'},
  lunge:    {n:'Zancadas', e:'🚶', d:'Da un paso largo y baja hasta que ambas rodillas estén a 90°. Alterna piernas.'},
  climber:  {n:'Mountain climbers', e:'⛰️', d:'En posición de plancha alta, lleva las rodillas al pecho alternando rápido.'},
  highknee: {n:'Rodillas arriba', e:'🏃', d:'Trota en el lugar subiendo las rodillas a la altura de la cadera.'},
  glute:    {n:'Puente de glúteo', e:'🍑', d:'Boca arriba, rodillas dobladas. Sube la cadera apretando glúteos y baja controlado.'},
  crunch:   {n:'Abdominales crunch', e:'🌀', d:'Boca arriba, rodillas dobladas. Sube los hombros del suelo usando el abdomen, sin jalar el cuello.'},
  bicycle:  {n:'Bicicleta', e:'🚲', d:'Boca arriba, lleva codo a rodilla contraria alternando, como pedaleando.'},
  legraise: {n:'Elevación de piernas', e:'🦿', d:'Boca arriba, piernas rectas. Súbelas a 90° y baja lento sin tocar el suelo.'},
  sideplank:{n:'Plancha lateral', e:'📐', d:'Apoyado en un antebrazo, cuerpo de lado en línea recta. Cambia de lado a la mitad.'},
  dips:     {n:'Fondos en silla', e:'🪑', d:'Manos en el borde de una silla firme, baja doblando codos y sube.'},
  wallsit:  {n:'Sentadilla en pared', e:'🧍', d:'Espalda contra la pared, baja hasta rodillas a 90° y aguanta.'},
  skater:   {n:'Saltos de patinador', e:'⛸️', d:'Salta de lado a lado aterrizando en una pierna, como patinador.'},
  superman: {n:'Superman', e:'🦸', d:'Boca abajo, eleva brazos y piernas a la vez, aguanta 1 s y baja.'},
};

// Rutinas. type: 'time' (segundos) o 'reps'. Valores por nivel [1,2,3].
const ROUTINES = [
  {id:'hiit', name:'HIIT Quema grasa', emoji:'🔥', color:'#ff6b2c', desc:'Cardio intenso por intervalos. Lo mejor para quemar grasa.',
   rounds:[2,3,4], rest:[25,20,15], roundRest:60,
   items:[['jumping','time',[30,40,45]],['squat','time',[30,40,45]],['climber','time',[30,40,45]],['highknee','time',[30,40,45]],['burpee','time',[20,30,40]],['skater','time',[30,40,45]]]},
  {id:'fuerza', name:'Fuerza total', emoji:'💪', color:'#5b8cff', desc:'Trabaja todo el cuerpo con tu propio peso.',
   rounds:[2,3,4], rest:[45,40,30], roundRest:75,
   items:[['squat','reps',[12,15,20]],['pushup','reps',[6,10,15]],['lunge','reps',[10,14,20]],['dips','reps',[8,12,15]],['glute','reps',[12,15,20]],['wallsit','time',[30,45,60]]]},
  {id:'core', name:'Core de acero', emoji:'🧱', color:'#22c55e', desc:'Abdomen y zona media firme.',
   rounds:[2,3,3], rest:[20,20,15], roundRest:45,
   items:[['plank','time',[30,40,60]],['crunch','reps',[12,16,20]],['bicycle','time',[30,40,45]],['legraise','reps',[8,12,15]],['sideplank','time',[30,40,50]],['superman','reps',[10,12,15]]]},
  {id:'express', name:'Express 10 min', emoji:'⚡', color:'#eab308', desc:'Para días sin tiempo. ¡Algo es mejor que nada!',
   rounds:[2,2,3], rest:[15,15,10], roundRest:30,
   items:[['jumping','time',[40,40,40]],['squat','time',[40,40,40]],['pushup','time',[30,40,40]],['plank','time',[30,40,45]]]},
];

// Plan de 8 semanas: rutina por día (0=domingo descanso)
const WEEK_PLAN = {1:'hiit',2:'fuerza',3:'core',4:'hiit',5:'fuerza',6:'hiit',0:null};
const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const PETS = {
  dog:    {name:'Perrito', stages:['🐶','🐕','🦮','🐺']},
  cat:    {name:'Gatito', stages:['🐱','🐈','🐈‍⬛','🐯']},
  dragon: {name:'Dragón', stages:['🥚','🦎','🐲','🐉']},
  bear:   {name:'Osito', stages:['🧸','🐻','🐻‍❄️','🦁']},
};
const STAGE_NAMES = ['Bebé','Joven','Adulto','Épico'];

const PET_LINES = {
  happy:['¡Hoy toca darle duro! 💥','¡Estoy orgulloso de ti!','Cada día cuenta. ¡Vamos!','¡Juntos somos imparables!','Tu yo del futuro te lo agradecerá.'],
  sad:['Te extrañé... ¿entrenamos hoy? 🥺','Me siento sin energía, ¡ayúdame moviéndote!','No pasa nada, hoy volvemos a empezar.'],
  done:['¡Lo lograste hoy! 🎉 A descansar.','¡Misión cumplida! Toma agua 💧','¡Racha protegida! Eres una máquina.'],
  work:['¡Tú puedes!','¡No te rindas!','¡Respira y sigue!','¡Eso es!','¡Ya casi!'],
};

const HABITS = [
  {id:'water', e:'💧', n:'Vasos de agua', goal:8, count:true},
  {id:'veg', e:'🥦', n:'Verduras en 2 comidas'},
  {id:'protein', e:'🍗', n:'Proteína en cada comida'},
  {id:'nosugar', e:'🚫', n:'Sin refresco ni azúcar'},
  {id:'nojunk', e:'🍟', n:'Sin comida chatarra'},
  {id:'sleep', e:'😴', n:'Dormir 7+ horas'},
];

const ACHIEVEMENTS = [
  {id:'first', e:'🌱', n:'Primer paso', d:'Completa tu primer entreno', t:s=>s.total>=1},
  {id:'s3', e:'🔥', n:'En llamas', d:'Racha de 3 días', t:s=>s.best>=3},
  {id:'s7', e:'📅', n:'Semana perfecta', d:'Racha de 7 días', t:s=>s.best>=7},
  {id:'s30', e:'🏆', n:'Imparable', d:'Racha de 30 días', t:s=>s.best>=30},
  {id:'w10', e:'💯', n:'Diez de diez', d:'10 entrenos completados', t:s=>s.total>=10},
  {id:'w50', e:'🦾', n:'Veterano', d:'50 entrenos completados', t:s=>s.total>=50},
  {id:'hab', e:'🥗', n:'Comer bien', d:'Todos los hábitos en un día', t:s=>s.perfectFood>=1},
  {id:'lvl5', e:'⭐', n:'Nivel 5', d:'Alcanza el nivel 5', t:s=>s.level>=5},
  {id:'min', e:'⏳', n:'300 minutos', d:'Entrena 300 min en total', t:s=>s.minutes>=300},
];
