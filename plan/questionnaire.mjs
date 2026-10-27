// UI prototype inspired by documented Runna fields. No plan engine or Firebase mapping.
export const SCHEMA = 2;
export const STORAGE_KEY = 'kipzone-questionnaire-ui-v2';
export const TTL = 7 * 86400000;
export const weekdays = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export const goalLabels = {race:'Preparar una carrera',improve:'Mejorar mi marca',wellbeing:'Correr con constancia',startRunning:'Empezar a correr',returnToRunning:'Volver a correr'};
export const experienceLabels = {beginner:'Principiante',intermediate:'Intermedio',advanced:'Avanzado',elite:'Élite'};
export const distanceLabels = {'5':'5K','10':'10K','16.09344':'10 millas','21.0975':'Media maratón','42.195':'Maratón',ultra:'Ultra',custom:'Otra distancia'};
// Approved short benefit screens. Questions and their relative order stay intact.
export const EDITORIAL_SCREENS = [
  {
    id:'norwegian-achievements',after:'goal',eyebrow:'Inspiración noruega',
    title:'Récords.\nMedallas.',
    body:'Jakob Ingebrigtsen: oros olímpicos en 1500 y 5000 m. Récord mundial de 3000 m logrado en 2024.',
    caption:'Una referencia del entrenamiento noruego.',
    sources:[
      {label:'World Athletics · logros deportivos',url:'https://worldathletics.org/athletes/_/14653717'},
      {label:'World Athletics · oro en París 2024',url:'https://worldathletics.org/results/olympic-games/2024/the-xxxiii-olympic-games-7153115/men/5000-metres/final/result'},
      {label:'Artículo sobre entrenamiento noruego (2023)',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC10000870/'}
    ]
  },
  {
    id:'norwegian-principles',after:['experience','exerciseLevel'],eyebrow:'Método noruego',
    title:'Revoluciona tu forma\nde entrenar.',
    body:'Controla la intensidad. Combina rodajes fáciles y trabajo de umbral. Deja espacio para recuperar.',
    tags:['Intensidad','Umbral','Recuperación'],
    sources:[{label:'Marius Bakken · principios del modelo',url:'https://www.mariusbakken.com/the-norwegian-model.html'}]
  },
  {
    id:'norwegian-for-you',after:'availableDays',eyebrow:'Corredores recreativos',
    title:'Tu tiempo.\nTu potencial.',
    body:'Del alto rendimiento a tu rutina. Tu nivel, tus metas y tu disponibilidad como punto de partida.',
    tags:['Tu nivel','Tus metas','Tu semana'],
    sources:[{label:'Marius Bakken · adaptación a corredores recreativos',url:'https://extramilest.com/blog/the-norwegian-method-for-runners-the-extramilest-show-139/'}]
  }
];
export function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(`${v}T12:00:00`);return Number.isFinite(d.getTime())&&dateKey(d)===v;}
export function formatDate(v){return validDate(v)?new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`)):'Sin fecha';}
export function createDraft(){return {schemaVersion:SCHEMA,answers:{}};}
const opt=(value,label)=>({value,label});
const choice=(id,group,title,options,extra={})=>({id,group,title,type:'choice',options,...extra});
const number=(id,group,title,min,max,unit,extra={})=>({id,group,title,type:'number',min,max,unit,...extra});
const yesNo=[opt('yes','Sí'),opt('no','No')];
export function isFoundation(a){return ['startRunning','returnToRunning'].includes(a.goal);}
export function stepsFor(draft,editorial=EDITORIAL_SCREENS){
  const a=draft.answers,foundation=isFoundation(a),unit=a.units==='mi'?'mi':'km';
  const s=[choice('goal','Tu objetivo','¿Qué quieres conseguir?',Object.entries(goalLabels).map(([v,l])=>opt(v,l)))];
  if(['race','improve'].includes(a.goal)){
    s.push(choice('distance','Tu objetivo','¿Qué distancia?',Object.entries(distanceLabels).map(([v,l])=>opt(v,l)),{compact:true}));
    if(['custom','ultra'].includes(a.distance))s.push(number('customDistance','Tu objetivo','¿Cuántos kilómetros?',a.distance==='ultra'?42.196:0.1,1000,'km',{decimal:true}));
  }
  if(a.goal==='race'){
    s.push(choice('hasRace','Tu carrera','¿Ya tienes una carrera elegida?',yesNo));
    if(a.hasRace==='yes')s.push({id:'raceName',group:'Tu carrera',title:'¿Cómo se llama la carrera?',type:'text',optional:true},{id:'raceDate',group:'Tu carrera',title:'¿Cuándo es la carrera?',type:'date'});
  }
  s.push(choice('units','Tus preferencias','¿En qué unidad corres?',[opt('km','Kilómetros'),opt('mi','Millas')]));
  if(foundation){
    s.push(choice('exerciseLevel','Tu punto de partida','¿Qué tan activo/a eres?',[opt('low','Poco activo/a'),opt('moderate','Algo activo/a'),opt('high','Muy activo/a')]));
    s.push(number('exerciseFrequency','Tu punto de partida','¿Cuántos días haces ejercicio?',0,7,'días por semana',{chips:[0,1,2,3,4,5,6,7]}));
    if(a.goal==='returnToRunning')s.push(number('monthsSinceLastRun','Tu punto de partida','¿Cuántos meses llevas sin correr?',0,1200,'meses',{optional:true,skipLabel:'No lo recuerdo'}));
  }else{
    s.push(choice('experience','Tu experiencia','¿Cuál es tu nivel?',Object.entries(experienceLabels).map(([v,l])=>opt(v,l))));
    s.push(choice('hasReference','Tu ritmo actual','¿Conoces tu tiempo en una distancia?',yesNo));
    if(a.hasReference==='yes')s.push(choice('referenceDistance','Tu ritmo actual','¿De qué distancia es tu tiempo?',[opt('5','5K'),opt('10','10K'),opt('21.0975','Media maratón'),opt('42.195','Maratón')]),{id:'referenceTime',group:'Tu ritmo actual',title:'¿En cuánto tiempo la corres?',type:'clock',help:'Tiempo actual · mm:ss o hh:mm:ss'});
    s.push(number('currentWeeklyMileage','Tu entrenamiento actual','¿Cuánto corres por semana?',0,1000,unit,{decimal:true,optional:true,skipLabel:'No lo sé'}));
    s.push(number('currentLongestRun','Tu entrenamiento actual','¿Cuál es tu salida más larga?',0,1000,unit,{decimal:true,optional:true,skipLabel:'No lo sé'}));
  }
  s.push(number('runsPerWeek','Tu semana','¿Cuántos días quieres correr?',1,7,'días por semana',{chips:[1,2,3,4,5,6,7]}));
  s.push({id:'availableDays',group:'Tu semana',title:'¿Qué días puedes correr?',type:'days',help:'Puedes elegir más días que salidas.'});
  if(!foundation)s.push({id:'longRunDay',group:'Tu semana',title:'¿Qué día prefieres para la tirada larga?',type:'select',optional:true});
  s.push({id:'startDate',group:'Tu calendario',title:'¿Cuándo quieres empezar?',type:'date'});
  if(!(a.goal==='race'&&a.hasRace==='yes'))s.push(number('weeks','Tu calendario','¿Cuántas semanas?',1,52,'semanas',{chips:[6,8,10,12,16]}));
  // A local preview sequence, not a universal V1/V2/Foundation Runna order.
  return s.flatMap(step=>[step,...editorial.filter(e=>Array.isArray(e.after)?e.after.includes(step.id):e.after===step.id).map(e=>({...e,type:'editorial',group:'Sobre el método'}))]);
}
export function clockSeconds(text){
  if(typeof text!=='string'||!/^\d{1,3}:\d{2}(:\d{2})?$/.test(text))return null;
  const p=text.split(':').map(Number);if(p.at(-1)>59||(p.length===3&&p[1]>59))return null;
  const total=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];return total>0?total:null;
}
function num(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;}
export function validateStep(step,draft){
  const a=draft.answers,v=a[step.id];
  if(step.type==='editorial')return '';
  if(step.optional&&(v===undefined||v===null||v===''||v==='none'))return '';
  if(step.type==='choice')return step.options.some(o=>o.value===v)?'':'Elige una respuesta.';
  if(step.type==='number'){
    const n=num(v);if(n===null||n<step.min||n>step.max||(!step.decimal&&!Number.isInteger(n)))return `Introduce ${step.decimal?'un número':'un número entero'} entre ${step.min} y ${step.max}.`;
    if(step.id==='currentLongestRun'&&num(a.currentWeeklyMileage)!==null&&n>Number(a.currentWeeklyMileage))return 'Revisa la distancia: supera tu total semanal.';
    return '';
  }
  if(step.type==='text')return typeof v==='string'&&v.trim().length<=120?'':'Usa un máximo de 120 caracteres.';
  if(step.type==='clock')return clockSeconds(v)!==null?'':'Usa mm:ss o hh:mm:ss.';
  if(step.type==='days'){
    if(!Array.isArray(v)||new Set(v).size!==v.length||v.some(d=>!Number.isInteger(d)||d<1||d>7))return 'Elige tus días disponibles.';
    return v.length>=Number(a.runsPerWeek||1)?'':`Elige al menos ${a.runsPerWeek||1} días.`;
  }
  if(step.type==='select')return (a.availableDays||[]).includes(Number(v))?'':'Elige un día disponible.';
  if(step.type==='date'){
    if(!validDate(v)||v<dateKey(new Date()))return 'Elige hoy o una fecha futura.';
    if(step.id==='startDate'&&a.goal==='race'&&a.hasRace==='yes'&&validDate(a.raceDate)&&v>a.raceDate)return 'El inicio debe ser anterior o igual a la carrera.';
    return '';
  }
  return 'Revisa la respuesta.';
}
export function pruneAnswers(draft){
  const active=new Set(stepsFor(draft).map(s=>s.id));
  for(const key of Object.keys(draft.answers))if(!active.has(key))delete draft.answers[key];
  const a=draft.answers;if(a.longRunDay&&!a.availableDays?.includes(Number(a.longRunDay)))a.longRunDay='none';
}
export function decodeSaved(raw,now=Date.now()){
  try{const s=JSON.parse(raw),d=s.draft;
    if(s.schemaVersion!==SCHEMA||!Number.isFinite(s.savedAt)||now-s.savedAt>TTL||s.savedAt>now+60000||d?.schemaVersion!==SCHEMA||!d.answers||typeof d.answers!=='object'||Array.isArray(d.answers))return null;
    if(Object.entries(d.answers).some(([k,v])=>k==='availableDays'?(!Array.isArray(v)||v.some(n=>!Number.isInteger(n)||n<1||n>7)):!['string','number'].includes(typeof v)))return null;
    pruneAnswers(d);return d;
  }catch{return null;}
}
