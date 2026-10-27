import {SCHEMA,STORAGE_KEY,stepsFor,validateStep,createDraft,pruneAnswers,decodeSaved,weekdays,formatDate,dateKey,goalLabels,distanceLabels} from './questionnaire.mjs';
const app=document.querySelector('#app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft=createDraft(),view='welcome',remember=false,saved=null,editing=false;
try{saved=decodeSaved(localStorage.getItem(STORAGE_KEY));}catch{}
function save(){if(remember)try{localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:SCHEMA,savedAt:Date.now(),draft}));}catch{document.querySelector('#storage-status')?.replaceChildren('No se pudo guardar. Mantén esta página abierta.');}}
function forget(){try{localStorage.removeItem(STORAGE_KEY);}catch{}saved=null;remember=false;}
function go(next,replace=false){view=next;history[replace?'replaceState':'pushState']({view},'',`#${next}`);render();window.scrollTo(0,0);document.querySelector('h1')?.focus({preventScroll:true});}
history.replaceState({view},'','#welcome');
window.addEventListener('popstate',e=>{const v=e.state?.view;view=['welcome','review','result',...stepsFor(draft).map(s=>s.id)].includes(v)?v:'welcome';editing=false;render();document.querySelector('h1')?.focus({preventScroll:true});});
const back=target=>`<button class="back" data-go="${esc(target)}" type="button"><span aria-hidden="true">←</span> Volver</button>`;
const next=label=>`<div class="action-area"><p class="error" id="error" role="alert"></p><button class="primary" type="submit">${label||'Continuar'}<span aria-hidden="true">→</span></button></div>`;
function render(){
  const steps=stepsFor(draft),i=steps.findIndex(s=>s.id===view),active=steps[i];
  document.body.dataset.theme=view==='welcome'||view==='result'||active?.type==='editorial'?'dark':'light';
  document.querySelector('#progress-region').hidden=i<0;
  const questions=steps.filter(s=>s.type!=='editorial');
  const pos=active?.type==='editorial'?steps.slice(0,i+1).filter(s=>s.type!=='editorial').length-1:questions.findIndex(s=>s.id===view);
  document.querySelector('#section-name').textContent=active?.group||'';
  document.querySelector('#step-count').textContent=pos>=0?`${pos+1} / ${questions.length}`:'';
  document.querySelector('#progress').value=pos>=0?(pos+1)/questions.length*100:0;
  if(view==='welcome')welcome();else if(view==='review')review();else if(view==='result')result();else if(active)question(active,i,steps);else{view='welcome';welcome();}
  app.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{editing=false;go(b.dataset.go);}));
}
function welcome(){
  app.innerHTML=`<section class="intro"><div class="eyebrow">Método noruego</div><h1 tabindex="-1">Tu meta.<br><em>Tu plan.</em></h1><p class="intro-sub">Cuéntanos cómo corres.</p><div class="hero-art" role="img" aria-label="Una mujer y un hombre corriendo de espaldas, sin rostros identificables"></div><div class="intro-actions">${saved?'<button class="secondary" id="resume">Retomar mis respuestas →</button>':''}<button class="primary" id="begin">${saved?'Empezar de nuevo':'Comenzar'}<span aria-hidden="true">→</span></button><label class="save-choice"><input type="checkbox" id="remember" ${remember?'checked':''}>Recordar mis respuestas</label><p class="fine">Solo en este navegador · 7 días</p>${saved?'<button class="text-button" id="forget">Borrar respuestas guardadas</button>':''}<p id="storage-status" class="fine" role="status"></p></div></section>`;
  document.querySelector('#remember').addEventListener('change',e=>{remember=e.target.checked;if(remember)save();else forget();});
  document.querySelector('#begin').addEventListener('click',()=>{const keep=remember;forget();remember=keep;draft=createDraft();editing=false;save();go('goal');});
  document.querySelector('#resume')?.addEventListener('click',()=>{draft=saved;remember=true;go(stepsFor(draft).find(s=>validateStep(s,draft))?.id||'review');});
  document.querySelector('#forget')?.addEventListener('click',()=>{forget();render();});
}
function field(name,label,value,attrs=''){return `<label class="form-field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${attrs}></label>`;}
function inputFor(s){
  const a=draft.answers,v=a[s.id];
  if(s.type==='choice')return `<fieldset class="options ${s.compact?'compact-options':''}"><legend class="sr-only">${esc(s.title)}</legend>${s.options.map(o=>`<label class="option"><span>${esc(o.label)}</span><input type="radio" name="${s.id}" value="${esc(o.value)}" ${v===o.value?'checked':''}></label>`).join('')}</fieldset>`;
  if(s.type==='number')return `${field(s.id,'',v??'',`type="number" aria-label="Tu respuesta" inputmode="${s.decimal?'decimal':'numeric'}" min="${s.min}" max="${s.max}" step="${s.decimal?'any':'1'}" aria-describedby="unit error"`)}<p id="unit" class="unit">${esc(s.unit)}</p>${s.chips?`<div class="number-chips" role="group" aria-label="Respuestas rápidas">${s.chips.map(n=>`<button type="button" data-number="${n}" aria-pressed="${Number(v)===n&&v!==''}">${n}</button>`).join('')}</div>`:''}`;
  if(s.type==='days')return `<fieldset><legend class="sr-only">Días disponibles</legend><div class="day-grid">${weekdays.map((d,i)=>`<label class="day"><input type="checkbox" name="availableDays" value="${i+1}" ${(v||[]).includes(i+1)?'checked':''}><span>${d.slice(0,3)}</span></label>`).join('')}</div></fieldset>`;
  if(s.type==='select')return `<label class="form-field"><span>Día preferido</span><select name="${s.id}"><option value="none">Sin preferencia</option>${(a.availableDays||[]).map(d=>`<option value="${d}" ${Number(v)===d?'selected':''}>${weekdays[d-1]}</option>`).join('')}</select></label>`;
  if(s.type==='date')return field(s.id,'Fecha',v||'',`type="date" min="${dateKey(new Date())}" ${s.id==='startDate'&&a.raceDate?`max="${esc(a.raceDate)}"`:''}`);
  if(s.type==='clock')return field(s.id,'Tiempo actual',v||'','type="text" inputmode="text" placeholder="25:30" maxlength="12" autocomplete="off"');
  if(s.type==='text')return field(s.id,'Nombre',v||'','type="text" maxlength="120" autocomplete="off"');
  return '';
}
function collect(s,form){const f=new FormData(form);draft.answers[s.id]=s.type==='days'?f.getAll('availableDays').map(Number).sort((a,b)=>a-b):f.get(s.id)||'';pruneAnswers(draft);save();}
function question(s,i,steps){
  if(s.type==='editorial'){
    app.innerHTML=`<section class="editorial">${back(steps[i-1]?.id||'welcome')}<div class="eyebrow">${esc(s.eyebrow||'KipZone')}</div><h1 tabindex="-1">${esc(s.title)}</h1>${s.body?`<p class="editorial-copy">${esc(s.body)}</p>`:''}${s.tags?`<div class="benefit-tags">${s.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}<div class="editorial-art" role="img" aria-label="Corredora y corredor anónimos de espaldas"></div>${s.caption?`<p class="editorial-caption">${esc(s.caption)}</p>`:''}${s.sources?.length?`<details class="editorial-sources"><summary>Ver fuentes</summary><ul>${s.sources.map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)}</a></li>`).join('')}</ul></details>`:''}<div class="editorial-action"><button class="primary" data-go="${steps[i+1]?.id||'review'}">Continuar <span aria-hidden="true">→</span></button></div></section>`;return;
  }
  const art=['experience','exerciseLevel'].includes(s.id)?'<div class="visual-strip" role="img" aria-label="Una corredora y un corredor de espaldas"></div>':'';
  app.innerHTML=`<section class="question">${back(editing?'review':steps[i-1]?.id||'welcome')}${art}<div class="eyebrow">${esc(s.group)}</div><h1 tabindex="-1">${esc(s.title)}</h1>${s.help?`<p class="helper">${esc(s.help)}</p>`:''}<form novalidate>${inputFor(s)}${next(editing?'Guardar cambio':'Continuar')}${s.optional?`<button type="button" class="text-button skip" id="skip">${esc(s.skipLabel||'Omitir')}</button>`:''}<p class="fine" id="storage-status" role="status"></p></form></section>`;
  const form=app.querySelector('form');
  form.addEventListener('input',()=>collect(s,form));form.addEventListener('change',()=>collect(s,form));
  app.querySelectorAll('[data-number]').forEach(b=>b.addEventListener('click',()=>{form.querySelector('input').value=b.dataset.number;collect(s,form);app.querySelectorAll('[data-number]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));}));
  function advance(){const error=validateStep(s,draft);if(error){document.querySelector('#error').textContent=error;return;}if(editing){editing=false;go('review');return;}const all=stepsFor(draft),at=all.findIndex(x=>x.id===s.id);go(all[at+1]?.id||'review');}
  form.addEventListener('submit',e=>{e.preventDefault();collect(s,form);advance();});
  document.querySelector('#skip')?.addEventListener('click',()=>{draft.answers[s.id]=s.type==='select'?'none':'';save();advance();});
}
function describe(s){
  const a=draft.answers,v=a[s.id];if(validateStep(s,draft))return 'Por completar';
  if(s.optional&&(v===undefined||v===null||v===''))return 'Sin responder';
  if(s.type==='choice')return s.options.find(o=>o.value===v)?.label||'Sin responder';
  if(s.type==='days')return v.map(d=>weekdays[d-1]).join(', ');
  if(s.type==='date')return formatDate(v);
  if(s.type==='number')return `${v} ${s.unit}`;
  if(s.type==='select')return v==='none'?'Sin preferencia':weekdays[Number(v)-1];
  return v;
}
function review(){
  const steps=stepsFor(draft).filter(s=>s.type!=='editorial');
  app.innerHTML=`<section class="question">${back(steps.at(-1).id)}<div class="eyebrow">Tu perfil</div><h1 tabindex="-1">¿Todo correcto?</h1><div class="review-list">${steps.map(s=>`<div class="review-item"><div><span>${esc(s.title)}</span><strong>${esc(describe(s))}</strong></div><button class="edit" data-edit="${s.id}" aria-label="Editar: ${esc(s.title)}">Editar</button></div>`).join('')}</div><p id="error" class="error" role="alert"></p><button class="primary" id="finish">Confirmar respuestas <span aria-hidden="true">→</span></button></section>`;
  app.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>{editing=true;go(b.dataset.edit);}));
  document.querySelector('#finish').addEventListener('click',()=>{const pending=steps.find(s=>validateStep(s,draft));if(pending){editing=true;go(pending.id);}else go('result');});
}
function result(){
  const steps=stepsFor(draft).filter(s=>s.type!=='editorial'),missing=steps.find(s=>validateStep(s,draft));
  if(missing){view='review';review();return;}
  const a=draft.answers;
  app.innerHTML=`<section class="completion">${back('review')}<div class="eyebrow">Cuestionario completado</div><h1 tabindex="-1">Tus respuestas,<br><em>listas.</em></h1><div class="finish-art" role="img" aria-label="Una mujer y un hombre corriendo de espaldas"></div><div class="profile-summary"><span>${esc(goalLabels[a.goal])}</span>${a.distance?`<span>${esc(distanceLabels[a.distance])}</span>`:''}<span>${esc(a.runsPerWeek)} días / semana</span></div><button class="primary" data-go="review">Revisar mis respuestas <span aria-hidden="true">↗</span></button><p class="fine">Vista previa del cuestionario. Aún no genera un plan.</p></section>`;
}
render();
