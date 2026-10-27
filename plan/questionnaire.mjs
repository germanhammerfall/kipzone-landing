// KipZone web intake, not Runna's sequence or a prescription engine.
export const SCHEMA = 1;
export const STORAGE_KEY = 'kipzone-plan-intake-v1';
export const TTL = 7 * 86400000;
export const goalLabels = {fiveK:'Mejorar mi 5K',tenK:'Preparar 10K',wellbeing:'Correr con constancia',returnToRunning:'Volver a correr',startRunning:'Empezar a correr'};
export const experienceLabels = {starting:'Estoy empezando',regular:'Corro con regularidad',experienced:'Tengo experiencia'};
export const weekdays = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const option = (value, label, detail, icon) => ({value,label,detail,icon});
const numeric = (id,group,title,help,min,max,unit,optional=false) => ({id,group,title,help,type:'number',min,max,unit,optional});
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())&&dateKey(date)===value;
}
export function historyDates(now=new Date()) {
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  return Array.from({length:4},(_,i)=>{
    const start=new Date(monday);start.setDate(start.getDate()-(4-i)*7);
    const end=new Date(start);end.setDate(end.getDate()+6);
    return {start:dateKey(start),end:dateKey(end)};
  });
}
export function createDraft(now=new Date()) {
  return {schemaVersion:SCHEMA,referenceDate:dateKey(now),historyWindows:historyDates(now),answers:{}};
}
const yesNo=[option('yes','Sí'),option('no','No')];
export function stepsFor(draft) {
  const a=draft.answers;
  const steps=[
    {id:'goal',group:'Tu meta',title:'¿Qué quieres conseguir?',help:'Empecemos por lo que te mueve. Elige tu objetivo principal.',type:'choice',options:[
      option('fiveK',goalLabels.fiveK,'Buscar una mejor marca en 5 kilómetros.','5K'),
      option('tenK',goalLabels.tenK,'Entrenar con un objetivo de 10 kilómetros.','10K'),
      option('wellbeing',goalLabels.wellbeing,'Hacer del running parte de mi semana.','↗'),
      option('returnToRunning',goalLabels.returnToRunning,'Retomar después de una pausa.','↺'),
      option('startRunning',goalLabels.startRunning,'Dar mis primeras zancadas.','01')
    ]},
    {id:'experience',group:'Tu punto de partida',title:'¿Cómo describirías tu experiencia?',help:'Piensa en cómo entrenas hoy, sin compararte con otros.',type:'choice',options:[
      option('starting',experienceLabels.starting,'Estoy comenzando o todavía no tengo una rutina.'),
      option('regular',experienceLabels.regular,'Ya mantengo una rutina de carrera.'),
      option('experienced',experienceLabels.experienced,'Llevo tiempo entrenando de forma consistente.')
    ]},
    {id:'adult',group:'Tu punto de partida',title:'¿Tienes 18 años o más?',help:'El programa que estamos preparando está dirigido a personas adultas.',type:'choice',options:yesNo},
    {id:'noPain',group:'Tu punto de partida',title:'¿Puedes correr sin dolor ni restricciones?',help:'Responde según tu situación actual. Si tienes dolor o una restricción para correr, elige «No».',type:'choice',options:yesNo},
    {id:'noSymptoms',group:'Tu punto de partida',title:'¿Estás libre de síntomas de alarma al hacer ejercicio?',help:'Por ejemplo, dolor en el pecho, desmayo o falta de aire inusual. Si tienes alguno o no lo sabes, no continuaremos con una propuesta automática.',type:'choice',options:[...yesNo,option('unknown','No estoy seguro/a')]},
    numeric('currentDays','Cómo corres hoy','¿Cuántos días corres por semana?','Tu frecuencia actual, no la que te gustaría alcanzar.',0,7,'días'),
    numeric('currentMinutes','Cómo corres hoy','¿Cuánto tiempo corres por semana?','Suma los minutos de carrera de una semana habitual. Por ejemplo, cuatro salidas de una hora suman 240 minutos.',0,10080,'minutos por semana'),
    numeric('currentWeeklyKm','Cómo corres hoy','¿Cuántos kilómetros sumas por semana?','Si no lo sabes, puedes dejarlo sin responder. No lo calcularemos a partir de un ritmo supuesto.',0,1000,'kilómetros · opcional',true),
    numeric('longestRunKm','Cómo corres hoy','¿Cuál es tu salida más larga actual?','Distancia que ya puedes correr, no la que quieres alcanzar.',0,1000,'kilómetros · opcional',true),
    numeric('interruptionDays','Cómo corres hoy','¿Cuántos días seguidos llevas sin correr?','Incluye los días de descanso que llevas ahora. Si corriste hoy, escribe 0.',0,36500,'días'),
    numeric('weeklySessions','Tu disponibilidad','¿Cuántas salidas te gustaría hacer como máximo?','Es un límite, no una obligación. Tu semana puede tener menos salidas.',1,7,'salidas por semana'),
    {id:'availableDays',group:'Tu disponibilidad',title:'¿Qué días puedes correr?',help:'Marca todos los días que podrías usar. No significa que entrenarás en todos ellos.',type:'days'},
    numeric('availableMinutes','Tu disponibilidad','¿Cuánto tiempo tendrás para correr esta semana?','Tu tiempo disponible puede ser distinto de lo que corres actualmente.',1,10080,'minutos disponibles'),
    numeric('dayLimitMinutes','Tu disponibilidad','¿Cuál será tu máximo por salida?','Incluye calentamiento, recuperaciones y cierre. La propuesta inicial trabaja con salidas de 20 a 120 minutos.',20,120,'minutos por salida'),
    {id:'longRunDay',group:'Tu disponibilidad',title:'¿Qué día prefieres para una salida larga?',help:'Guardaremos la preferencia. Todavía no implica una tirada larga específica en el programa.',type:'select',optional:true},
    {id:'startDate',group:'Tu horizonte',title:'¿Cuándo te gustaría empezar?',help:'Elige una fecha desde hoy. Revisaremos la disponibilidad antes de generar una semana.',type:'date'},
    numeric('weeks','Tu horizonte','¿Cuántas semanas quieres organizar?','Es el horizonte que guardaremos. El plan se revisa semana a semana; esta respuesta no genera todas las sesiones.',1,26,'semanas'),
    {id:'hasRace',group:'Tu horizonte',title:'¿Tienes una carrera con fecha definida?',help:'Puedes tener un objetivo sin estar inscrito en una carrera.',type:'choice',options:yesNo}
  ];
  if(a.hasRace==='yes')steps.push({id:'raceDate',group:'Tu horizonte',title:'¿Cuándo es tu carrera?',help:'La fecha de carrera es independiente del fin del programa y debe quedar dentro de él.',type:'date'});
  steps.push({id:'hasReference',group:'Tu referencia',title:'¿Tienes una marca de una carrera realizada?',help:'Una sola referencia es suficiente. No necesitas aportar marcas de 5K y 10K. Si no tienes una, conservaremos ese dato como pendiente.',type:'choice',options:yesNo});
  if(a.hasReference==='yes')steps.push({id:'reference',group:'Tu referencia',title:'Cuéntanos tu marca actual',help:'Una carrera ya realizada. Tu objetivo futuro no es una marca actual.',type:'reference'});
  draft.historyWindows.forEach((w,i)=>steps.push({id:`history${i}`,group:`Tu historial · ${i+1} de 4`,title:'¿Cómo fue esta semana?',help:`Del ${formatDate(w.start)} al ${formatDate(w.end)}. Queremos conocer lo que realmente hiciste.`,type:'history',window:w}));
  return steps;
}
export function formatDate(value) {
  if(!validDate(value))return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`));
}
function num(value) {return value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;}
function integer(value) {const n=num(value);return n!==null&&Number.isInteger(n)?n:null;}
export function validateStep(step,draft) {
  const a=draft.answers,v=a[step.id];
  if(step.type==='choice')return step.options.some(o=>o.value===v)?'':'Elige una respuesta para continuar.';
  if(step.type==='number') {
    if(step.optional&&(v===''||v===undefined||v===null))return '';
    const n=num(v);
    if(n===null||n<step.min||n>step.max||(!step.optional&&!Number.isInteger(n)))return `Escribe ${step.optional?'un número':'un número entero'} entre ${step.min} y ${step.max}.`;
    if(step.id==='currentMinutes'&&((n===0)!==(Number(a.currentDays)===0)))return 'Si no corres ningún día, el tiempo debe ser 0. Si corres, indica un tiempo mayor que 0.';
    if(step.id==='longestRunKm'&&num(a.currentWeeklyKm)!==null&&n>Number(a.currentWeeklyKm))return 'La salida más larga no puede superar tu kilometraje semanal actual. Revisa ambos datos.';
    return '';
  }
  if(step.type==='days')return Array.isArray(v)&&v.length>0&&new Set(v).size===v.length&&v.every(d=>Number.isInteger(d)&&d>=1&&d<=7)?'':'Selecciona al menos un día disponible.';
  if(step.type==='select')return v===''||v===undefined||v===null||v==='none'||(a.availableDays||[]).includes(Number(v))?'':'Elige un día disponible o «Sin preferencia».';
  if(step.type==='date') {
    if(!validDate(v))return 'Elige una fecha válida.';
    if(step.id==='startDate'&&v<dateKey(new Date()))return 'Elige hoy o una fecha futura.';
    if(step.id==='raceDate'&&(v<a.startDate||v>endDate(a)))return 'La carrera debe quedar entre el inicio y el fin del programa. Puedes corregir su duración.';
    return '';
  }
  if(step.type==='reference') {
    if(!v||![5,10,21.0975,42.195].includes(Number(v.distance)))return 'Selecciona la distancia de tu carrera.';
    if(clockSeconds(v.time)===null)return 'Escribe el tiempo como mm:ss o hh:mm:ss, con segundos entre 00 y 59.';
    if(!validDate(v.date)||v.date>dateKey(new Date()))return 'Indica la fecha de una carrera ya realizada.';
    return '';
  }
  if(step.type==='history') {
    if(!v||!['unknown','noTraining','trained'].includes(v.status))return 'Indica si entrenaste o si no tienes estos datos.';
    if(v.status!=='trained')return '';
    if(integer(v.minutes)===null||Number(v.minutes)<1||Number(v.minutes)>10080)return 'Indica entre 1 y 10080 minutos realizados.';
    if(integer(v.days)===null||Number(v.days)<1||Number(v.days)>7)return 'Indica entre 1 y 7 días de carrera.';
    if(integer(v.qualityMinutes)===null||Number(v.qualityMinutes)<0||Number(v.qualityMinutes)>Number(v.minutes))return 'Los minutos de intervalos deben estar entre 0 y el total realizado.';
    if(!['yes','no'].includes(v.tolerated))return 'Confirma cómo toleraste esa semana.';
    return '';
  }
  return 'Este paso no está disponible.';
}
export function clockSeconds(text) {
  if(typeof text!=='string'||!/^\d{1,3}:\d{2}(:\d{2})?$/.test(text))return null;
  const p=text.split(':').map(Number);
  if(p.at(-1)>59||(p.length===3&&p[1]>59))return null;
  const s=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];
  return s>0?s:null;
}
export function endDate(a) {
  if(!validDate(a.startDate)||integer(a.weeks)===null)return '';
  const d=new Date(`${a.startDate}T12:00:00`);d.setDate(d.getDate()+Number(a.weeks)*7-1);return dateKey(d);
}
export function earlyIssue(a) {
  if(a.goal&& !['fiveK','tenK'].includes(a.goal))return 'El programa inicial todavía no ofrece planes para este objetivo.';
  if(a.experience==='starting')return 'El programa inicial está dirigido a personas que ya corren con regularidad.';
  if(a.adult==='no')return 'El programa inicial está dirigido a personas de 18 años o más.';
  if(a.noPain==='no')return 'Con dolor o restricciones para correr, este programa no propone entrenamiento automáticamente.';
  if(a.noSymptoms==='no'||a.noSymptoms==='unknown')return 'No podemos proponer entrenamiento automático con síntomas de alarma o dudas sobre ellos.';
  return '';
}
export function median(values) {const s=[...values].sort((a,b)=>a-b);return Math.floor((s[1]+s[2])/2);}
export function historyRows(draft) {
  return draft.historyWindows.map((w,i)=>{
    const v=draft.answers[`history${i}`]||{};
    return {start:w.start,status:v.status||'unknown',minutes:v.status==='noTraining'?0:v.status==='trained'?num(v.minutes):null,days:v.status==='noTraining'?0:v.status==='trained'?num(v.days):null,qualityMinutes:v.status==='noTraining'?0:v.status==='trained'?num(v.qualityMinutes):null,tolerated:v.status==='trained'&&['yes','no'].includes(v.tolerated)?v.tolerated==='yes':null};
  });
}
export function assessDraft(draft,now=new Date()) {
  const a=draft.answers;
  const early=earlyIssue(a);
  if(early)return {status:'outsideScope',reasons:[early]};
  const invalid=stepsFor(draft).filter(s=>validateStep(s,draft));
  if(invalid.length)return {status:'incomplete',reasons:['Hay respuestas pendientes o que debes revisar.'],stepIds:invalid.map(s=>s.id)};
  if(JSON.stringify(draft.historyWindows)!==JSON.stringify(historyDates(now)))return {status:'stale',reasons:['Ha cambiado la semana de referencia. Actualiza las cuatro semanas antes de continuar.']};
  const rows=historyRows(draft);
  if(rows.some(w=>w.status==='unknown'))return {status:'incomplete',reasons:['Faltan antecedentes de entrenamiento. No conocer una semana no equivale a no haber entrenado.'],stepIds:rows.flatMap((w,i)=>w.status==='unknown'?[`history${i}`]:[])};
  const reasons=[];
  const minutes=median(rows.map(w=>w.minutes));
  const days=median(rows.map(w=>w.days));
  if(minutes<240||minutes>360||days<3)reasons.push('El alcance inicial requiere un historial habitual de 240–360 minutos y al menos tres días de carrera, según la mediana de cuatro semanas.');
  if(Number(a.interruptionDays)>=14)reasons.push('Después de dos semanas sin correr, este programa requiere revisar el retorno.');
  if(Math.min(days,Number(a.weeklySessions),a.availableDays.length,5)<3)reasons.push('Con estos antecedentes y disponibilidad no caben al menos tres salidas.');
  if(Number(a.interruptionDays)<7&&Math.max(...rows.map(w=>w.minutes))>2*Math.max(1,Math.min(...rows.map(w=>w.minutes))))reasons.push('Las últimas semanas varían demasiado. Hace falta revisar ese historial.');
  // These are only early checks. Scheduling, intensity, reductions and all other
  // sporting decisions remain the responsibility of the existing Dart engine.
  return {status:reasons.length?'outsideScope':'readyForReview',reasons,medianMinutes:minutes,medianDays:days};
}
export function toHandoff(draft,now=new Date()) {
  const a=draft.answers;
  const assessment=assessDraft(draft,now);
  return {schemaVersion:SCHEMA,kind:'kipzone-intake-draft',createdAt:now.toISOString(),source:'kipzone-web-questionnaire',declaredGoal:a.goal||null,requiresEngineValidation:true,planGenerated:false,assessment,
    configuration:{goal:a.goal==='startRunning'?null:a.goal||null,experience:a.experience||null,currentDays:num(a.currentDays),currentMinutes:num(a.currentMinutes),weeklySessions:num(a.weeklySessions),availableDays:a.availableDays||[],startDate:a.startDate||null,weeks:num(a.weeks),raceDate:a.hasRace==='yes'?a.raceDate||null:null,currentWeeklyKm:num(a.currentWeeklyKm),longestRunKm:num(a.longestRunKm),longRunDay:a.longRunDay&&a.longRunDay!=='none'?num(a.longRunDay):null},
    availability:{availableMinutes:num(a.availableMinutes),dayLimitMinutes:num(a.dayLimitMinutes)},confirmations:{adult:a.adult===undefined?null:a.adult==='yes',noPain:a.noPain===undefined?null:a.noPain==='yes',noSymptoms:['yes','no'].includes(a.noSymptoms)?a.noSymptoms==='yes':null},interruptionDays:num(a.interruptionDays),history:historyRows(draft),recentRace:a.hasReference==='yes'&&a.reference?{distance:Number(a.reference.distance),unit:'kilometres',seconds:clockSeconds(a.reference.time),date:a.reference.date}:null};
}
export function decodeSaved(raw,now=Date.now()) {
  try {
    const saved=JSON.parse(raw);
    if(saved.schemaVersion!==SCHEMA||!Number.isFinite(saved.savedAt)||now-saved.savedAt>TTL||saved.savedAt>now+60000||!saved.draft||saved.draft.schemaVersion!==SCHEMA||!saved.draft.answers||typeof saved.draft.answers!=='object'||Array.isArray(saved.draft.answers)||!Array.isArray(saved.draft.historyWindows)||saved.draft.historyWindows.length!==4||!saved.draft.historyWindows.every(w=>validDate(w.start)&&validDate(w.end)))return null;
    // Avoid using malformed untrusted local storage in navigation/rendering.
    const a=saved.draft.answers;
    if(a.availableDays!==undefined&&(!Array.isArray(a.availableDays)||!a.availableDays.every(d=>Number.isInteger(d)&&d>=1&&d<=7)))return null;
    if(['reference','history0','history1','history2','history3'].some(k=>a[k]!==undefined&&(!a[k]||typeof a[k]!=='object'||Array.isArray(a[k]))))return null;
    return saved.draft;
  }catch{return null;}
}
