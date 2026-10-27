import {SCHEMA,STORAGE_KEY,createDraft,stepsFor,validateStep,assessDraft,toHandoff,decodeSaved,goalLabels,experienceLabels,weekdays,formatDate,dateKey,endDate,historyDates,earlyIssue} from './questionnaire.mjs';

const app=document.querySelector('#app');
const progressRegion=document.querySelector('#progress-region');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft=createDraft(),view='welcome',remember=false,saved=null,returnToReview=false;
let storageWarning='';
try{saved=decodeSaved(localStorage.getItem(STORAGE_KEY));}catch{/* Storage is optional. */}

function save(){
  if(!remember)return;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:SCHEMA,savedAt:Date.now(),draft}));storageWarning='';}
  catch{storageWarning='No pudimos guardar en este dispositivo. Mantén esta página abierta para conservar las respuestas.';}
  const warning=document.querySelector('#storage-warning');
  if(warning)warning.textContent=storageWarning;
}
function clearSaved(){try{localStorage.removeItem(STORAGE_KEY);}catch{}saved=null;remember=false;}
function go(next,{replace=false}={}){
  view=next;
  history[replace?'replaceState':'pushState']({kipzoneIntake:true,view},'',`#${next}`);
  render();
  window.scrollTo({top:0,behavior:'instant'});
  document.querySelector('h1')?.focus({preventScroll:true});
}
window.addEventListener('popstate',e=>{
  const candidate=e.state?.kipzoneIntake?e.state.view:'welcome';
  view=['welcome','review','result',...stepsFor(draft).map(s=>s.id)].includes(candidate)?candidate:'welcome';
  render();document.querySelector('h1')?.focus({preventScroll:true});
});
history.replaceState({kipzoneIntake:true,view:'welcome'},'','#welcome');
function backButton(target){return `<button class="back" type="button" data-go="${esc(target)}"><span aria-hidden="true">←</span> Volver</button>`;}
function action(label='Continuar'){return `<div class="action-area"><p id="error" class="error" role="alert"></p><button class="primary" type="submit">${label}<span class="arrow" aria-hidden="true">→</span></button></div>`;}
function field(key,label,value='',attrs=''){return `<label class="form-field">${label}<input name="${key}" value="${esc(value)}" ${attrs}></label>`;}
function render(){
  const steps=stepsFor(draft),index=steps.findIndex(s=>s.id===view);
  progressRegion.hidden=view==='welcome';
  document.querySelector('#section-name').textContent=index>=0?steps[index].group:view==='review'?'Tus respuestas':'Tu punto de partida';
  document.querySelector('#step-count').textContent=index>=0?`${index+1} / ${steps.length}`:view==='review'?'Revisión':'Resultado';
  document.querySelector('#progress').value=index>=0?Math.round((index+1)/steps.length*100):100;
  if(view==='welcome')renderWelcome();
  else if(view==='review')renderReview();
  else if(view==='result')renderResult();
  else if(index>=0)renderQuestion(steps[index],index,steps);
  else{view='welcome';renderWelcome();}
  app.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.go)));
}
function renderWelcome(){
  app.innerHTML=`<section class="intro"><div class="eyebrow">Método noruego · para corredores</div><h1 tabindex="-1">Tu próxima<br>meta empieza<br><em>contigo.</em></h1><p class="intro-sub">Cuéntanos cómo corres y qué quieres conseguir. Encuentra tu punto de partida para entrenar con KipZone.</p><div class="hero-art" role="img" aria-label="Corredor preparándose para salir de noche, con los colores de KipZone"><div class="hero-stamp">MENOS IMPROVISACIÓN.<br><span>MÁS PROPÓSITO.</span></div></div><div class="intro-bottom"><div class="pill-row"><span class="pill">Según tu nivel</span><span class="pill">Tu tiempo disponible</span><span class="pill">Tu objetivo</span></div>${saved?`<div class="restore-box"><p>Tienes respuestas guardadas en este dispositivo.</p><button class="secondary" id="resume">Continuar mi cuestionario →</button><button class="text-button" id="forget">Borrar respuestas guardadas</button></div>`:''}<button class="primary" id="begin">${saved?'Empezar de nuevo':'Encontrar mi punto de partida'}<span class="arrow" aria-hidden="true">→</span></button><label class="save-choice"><input type="checkbox" id="remember" ${remember?'checked':''}><span>Guardar mis respuestas en este dispositivo durante 7 días. Incluye información de entrenamiento y salud.</span></label><p class="fine">Sin pago. Esta primera versión recoge tus respuestas y revisa el alcance inicial; todavía no genera tu plan.</p><p id="storage-warning" class="save-warning" role="status">${esc(storageWarning)}</p></div></section>`;
  document.querySelector('#remember').addEventListener('change',e=>{remember=e.target.checked;if(!remember)clearSaved();else save();});
  document.querySelector('#begin').addEventListener('click',()=>{const keep=remember;clearSaved();remember=keep;draft=createDraft();returnToReview=false;save();go('goal');});
  document.querySelector('#resume')?.addEventListener('click',()=>{draft=saved;remember=true;const next=stepsFor(draft).find(s=>validateStep(s,draft));go(earlyIssue(draft.answers)?'result':next?.id||'review');});
  document.querySelector('#forget')?.addEventListener('click',()=>{clearSaved();render();});
}
function choiceOptions(step,value){
  return `<fieldset class="options"><legend class="visually-hidden">${esc(step.title)}</legend>${step.options.map(o=>`<label class="option">${o.icon?`<span class="option-icon" aria-hidden="true">${esc(o.icon)}</span>`:''}<span class="option-copy">${esc(o.label)}${o.detail?`<small>${esc(o.detail)}</small>`:''}</span><input type="radio" name="${step.id}" value="${esc(o.value)}" ${value===o.value?'checked':''}></label>`).join('')}</fieldset>`;
}
function questionInput(step){
  const a=draft.answers,v=a[step.id];
  if(step.type==='choice')return choiceOptions(step,v);
  if(step.type==='number')return `${field(step.id,'Tu respuesta',v??'',`type="number" inputmode="${step.optional?'decimal':'numeric'}" min="${step.min}" max="${step.max}" step="${step.optional?'any':'1'}" autocomplete="off" aria-describedby="question-help error"`)}<p class="input-suffix">${esc(step.unit)}</p>`;
  if(step.type==='days')return `<fieldset><legend class="visually-hidden">Días disponibles</legend><div class="day-grid">${weekdays.map((d,i)=>`<label class="day"><input type="checkbox" name="availableDays" value="${i+1}" ${(v||[]).includes(i+1)?'checked':''}><span>${esc(d.slice(0,3))}</span></label>`).join('')}</div></fieldset>`;
  if(step.type==='select')return `<label class="form-field">Día preferido<select name="longRunDay"><option value="none">Sin preferencia</option>${(a.availableDays||[]).map(d=>`<option value="${d}" ${Number(v)===d?'selected':''}>${weekdays[d-1]}</option>`).join('')}</select></label>`;
  if(step.type==='date')return field(step.id,'Fecha',v||'',`type="date" min="${step.id==='startDate'?dateKey(new Date()):esc(a.startDate)}" ${step.id==='raceDate'?`max="${esc(endDate(a))}"`:''} aria-describedby="question-help error"`);
  if(step.type==='reference')return `<label class="form-field">Distancia<select name="distance"><option value="">Elige la distancia</option>${[[5,'5 km'],[10,'10 km'],[21.0975,'Media maratón'],[42.195,'Maratón']].map(([n,l])=>`<option value="${n}" ${Number(v?.distance)===n?'selected':''}>${l}</option>`).join('')}</select></label>${field('time','Tiempo realizado',v?.time||'','type="text" inputmode="text" placeholder="Ejemplo: 25:30" autocomplete="off"')}${field('date','Fecha de la carrera',v?.date||'',`type="date" max="${dateKey(new Date())}"`)}<p class="fine">La fecha y la antigüedad de esta referencia se conservarán. No estimamos una marca si no la conoces.</p>`;
  if(step.type==='history')return `<label class="form-field">Lo que ocurrió<select name="status"><option value="">Elige una respuesta</option><option value="trained" ${v?.status==='trained'?'selected':''}>Entrené</option><option value="noTraining" ${v?.status==='noTraining'?'selected':''}>Confirmo que no entrené</option><option value="unknown" ${v?.status==='unknown'?'selected':''}>No tengo estos datos</option></select></label>${v?.status==='trained'?`${field('minutes','Minutos totales de carrera',v.minutes??'','type="number" inputmode="numeric" min="1" max="10080" step="1"')}${field('days','Días en los que corriste',v.days??'','type="number" inputmode="numeric" min="1" max="7" step="1"')}${field('qualityMinutes','Minutos de trabajo en intervalos',v.qualityMinutes??'','type="number" inputmode="numeric" min="0" max="10080" step="1"')}<p class="fine">Solo los tramos de trabajo: sin calentamiento, recuperaciones ni cierre. Si no hiciste intervalos, escribe 0.</p><label class="form-field">¿Toleraste esa semana sin dificultad inusual?<select name="tolerated"><option value="">Elige una respuesta</option><option value="yes" ${v.tolerated==='yes'?'selected':''}>Sí</option><option value="no" ${v.tolerated==='no'?'selected':''}>No</option></select></label>`:''}${v?.status==='unknown'?'<p class="notice">Lo conservaremos como desconocido. No lo sustituiremos por una semana de descanso ni inventaremos minutos.</p>':''}`;
  return '';
}
function collect(step,form){
  const data=new FormData(form),a=draft.answers;
  if(step.type==='days') {
    a.availableDays=data.getAll('availableDays').map(Number).sort((x,y)=>x-y);
    if(a.longRunDay&&!a.availableDays.includes(Number(a.longRunDay)))a.longRunDay='none';
  }else if(step.type==='reference'||step.type==='history')a[step.id]=Object.fromEntries(data);
  else a[step.id]=data.get(step.id)??'';
  if(step.id==='hasRace'&&a.hasRace!=='yes')delete a.raceDate;
  if(step.id==='hasReference'&&a.hasReference!=='yes')delete a.reference;
  save();
}
function renderQuestion(step,index,steps){
  app.innerHTML=`<section class="question">${backButton(returnToReview?'review':index===0?'welcome':steps[index-1].id)}<div class="eyebrow">${esc(step.group)}</div><h1 tabindex="-1">${esc(step.title)}</h1><p id="question-help" class="helper">${esc(step.help)}</p><form novalidate>${questionInput(step)}${action(returnToReview?'Guardar cambio':'Continuar')}${step.optional?'<button class="text-button skip" type="button" id="skip">Prefiero omitir este dato</button>':''}<p id="storage-warning" class="save-warning" role="status">${esc(storageWarning)}</p></form></section>`;
  const form=app.querySelector('form');
  form.addEventListener('input',()=>collect(step,form));
  form.addEventListener('change',e=>{
    collect(step,form);
    if(step.type==='history'&&e.target.name==='status'){
      // Status changes remove stale figures from the UI and its draft.
      if(draft.answers[step.id].status!=='trained')draft.answers[step.id]={status:draft.answers[step.id].status};
      save();render();app.querySelector('[name="status"]')?.focus();
    }
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();collect(step,form);
    const error=validateStep(step,draft);
    if(error){document.querySelector('#error').textContent=error;return;}
    if(earlyIssue(draft.answers)){returnToReview=false;go('result');return;}
    if(returnToReview){returnToReview=false;go('review');return;}
    const current=stepsFor(draft),i=current.findIndex(s=>s.id===step.id);go(current[i+1]?.id||'review');
  });
  document.querySelector('#skip')?.addEventListener('click',()=>{draft.answers[step.id]=step.type==='select'?'none':'';save();const current=stepsFor(draft),i=current.findIndex(s=>s.id===step.id);if(returnToReview){returnToReview=false;go('review');}else go(current[i+1]?.id||'review');});
}
function describe(step){
  const a=draft.answers,v=a[step.id];
  if(validateStep(step,draft))return 'Pendiente de completar o corregir';
  if(step.type==='choice')return step.options.find(o=>o.value===v)?.label||'Sin responder';
  if(step.type==='number')return v===''||v===undefined||v===null?'Sin responder (opcional)':`${v} ${step.unit.replace(' · opcional','')}`;
  if(step.type==='date')return formatDate(v);
  if(step.type==='days')return v.map(d=>weekdays[d-1]).join(', ');
  if(step.type==='select')return v&&v!=='none'?weekdays[Number(v)-1]:'Sin preferencia';
  if(step.type==='reference')return `${v.distance} km · ${v.time} · ${formatDate(v.date)}`;
  if(step.type==='history')return v.status==='unknown'?'No tengo estos datos':v.status==='noTraining'?'No entrené (confirmado)':`${v.minutes} min · ${v.days} días · ${v.qualityMinutes} min de intervalos · ${v.tolerated==='yes'?'bien tolerada':'con dificultad inusual'}`;
  return '';
}
function renderReview(){
  const steps=stepsFor(draft).filter(s=>!earlyIssue(draft.answers)||Object.hasOwn(draft.answers,s.id));
  app.innerHTML=`<section class="question">${backButton(steps.at(-1).id)}<div class="eyebrow">Antes de continuar</div><h1 tabindex="-1">Este es tu punto<br>de partida.</h1><p class="helper">Revisa tus respuestas. Puedes corregir cualquier dato antes de consultar el resultado.</p><div>${steps.map((s,i)=>`${i===0||s.group!==steps[i-1].group?`<div class="review-heading"><h2>${esc(s.group)}</h2></div>`:''}<div class="review-item"><div><span>${s.type==='history'?`${formatDate(s.window.start)} — ${formatDate(s.window.end)}`:esc(s.title)}</span><strong>${esc(describe(s))}</strong></div><button class="edit" data-edit="${s.id}" aria-label="Editar: ${esc(s.title)}${s.type==='history'?` ${esc(formatDate(s.window.start))}`:''}">Editar</button></div>`).join('')}</div><div class="actions"><button class="primary" id="check">Revisar mi compatibilidad <span class="arrow" aria-hidden="true">→</span></button><p class="fine">Esta revisión inicial no genera sesiones ni activa una suscripción.</p></div></section>`;
  app.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('click',()=>{returnToReview=true;go(el.dataset.edit);}));
  document.querySelector('#check').addEventListener('click',()=>{returnToReview=false;go('result');});
}
function renderResult(){
  const result=assessDraft(draft),ready=result.status==='readyForReview',outside=result.status==='outsideScope';
  const title=ready?'Ya tenemos tu<br>punto de partida.':outside?'Tu objetivo merece<br>el plan adecuado.':result.status==='stale'?'Actualicemos<br>tu historial.':'Falta una pieza<br>de tu historia.';
  const message=ready?'Tus respuestas pasan las comprobaciones iniciales del cuestionario. Aún hace falta validarlas con el generador de KipZone.':outside?'El programa inicial todavía no cubre tu situación. No te ofreceremos un plan que no podamos preparar.':'Puedes corregir o completar tus respuestas. Conservaremos lo que ya nos contaste.';
  app.innerHTML=`<section class="question">${backButton(earlyIssue(draft.answers)?'goal':'review')}<div class="result-mark" aria-hidden="true">${ready?'↗':outside?'↗':'…'}</div><div class="eyebrow">Tu resultado inicial</div><h1 tabindex="-1">${title}</h1><p class="helper">${message}</p>${ready?`<div class="metric-grid"><div class="metric"><strong>${result.medianMinutes}</strong><span>min/semana · mediana declarada</span></div><div class="metric"><strong>${result.medianDays}</strong><span>días/semana · mediana declarada</span></div></div><div class="result-card"><h2>Lo que quieres conseguir</h2><p>${esc(goalLabels[draft.answers.goal])}</p><p class="fine">${esc(experienceLabels[draft.answers.experience])} · hasta ${esc(draft.answers.weeklySessions)} salidas deseadas.</p></div>`:`<div class="result-card"><h2>${outside?'Por qué no continuamos automáticamente':'Lo que falta revisar'}</h2><ul>${result.reasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul></div>`}<p class="notice">Esta página todavía no genera un plan ni envía tus respuestas a la app. Puedes descargar una copia para conservarlas. No se ha realizado ningún cobro.</p><div class="actions">${result.status==='stale'?'<button class="primary" id="refresh-history">Actualizar las semanas →</button>':result.status==='incomplete'?'<button class="primary" id="complete">Completar mis respuestas →</button>':''}<button class="${ready?'primary':'secondary'}" id="export">Descargar mis respuestas <span aria-hidden="true">↓</span></button><a class="secondary" href="../#descargar">Conocer y descargar KipZone <span aria-hidden="true">↗</span></a><button class="text-button" id="edit-result">${earlyIssue(draft.answers)?'Revisar mis respuestas iniciales':'Revisar todas mis respuestas'}</button><button class="text-button" id="reset">Borrar mis respuestas</button></div><p id="result-status" class="fine" role="status"></p></section>`;
  document.querySelector('#export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(toHandoff(draft),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='kipzone-mis-respuestas.json';link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    document.querySelector('#result-status').textContent='Copia preparada. El archivo contiene tus respuestas, no un plan; todavía no se importa automáticamente en KipZone.';
  });
  document.querySelector('#complete')?.addEventListener('click',()=>{returnToReview=false;go(result.stepIds?.[0]||'goal');});
  document.querySelector('#refresh-history')?.addEventListener('click',()=>{
    const old=draft.historyWindows.map((w,i)=>({start:w.start,answer:draft.answers[`history${i}`]}));
    draft.historyWindows=historyDates();draft.referenceDate=dateKey(new Date());
    draft.historyWindows.forEach((w,i)=>{const matching=old.find(o=>o.start===w.start);if(matching?.answer)draft.answers[`history${i}`]=matching.answer;else delete draft.answers[`history${i}`];});
    save();returnToReview=false;go('history0');
  });
  document.querySelector('#edit-result').addEventListener('click',()=>{returnToReview=false;go('review');});
  document.querySelector('#reset').addEventListener('click',()=>{
    if(window.confirm('¿Borrar tus respuestas de este cuestionario y de este dispositivo?')){clearSaved();draft=createDraft();returnToReview=false;go('welcome');}
  });
}
render();
