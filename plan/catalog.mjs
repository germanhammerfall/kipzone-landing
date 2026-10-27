import {scenarios,screensFor} from './preview-data.mjs';
const select=document.querySelector('#route'),grid=document.querySelector('#screens');
const params=new URLSearchParams(location.search);
for(const s of scenarios){const o=document.createElement('option');o.value=s.id;o.textContent=s.label;select.append(o);}
select.value=scenarios.some(s=>s.id===params.get('route'))?params.get('route'):'race';
function render(){
  const route=select.value,screens=screensFor(route);grid.replaceChildren();
  document.querySelector('#count').textContent=`${screens.filter(s=>!['editorial','welcome','review','result'].includes(s.type)).length} preguntas · ${screens.length} pantallas`;
  history.replaceState(null,'',`?route=${encodeURIComponent(route)}`);
  screens.forEach((s,i)=>{
    const card=document.createElement('article'),heading=document.createElement('h2'),tag=document.createElement('p'),frame=document.createElement('iframe'),link=document.createElement('a');
    card.className='card';heading.textContent=`${String(i+1).padStart(2,'0')} · ${s.title.replaceAll('\n',' ')}`;
    tag.textContent=s.type==='editorial'?'Mensaje intermedio':s.group||'Inicio y cierre';tag.className='tag';
    const url=`./preview.html?scenario=${encodeURIComponent(route)}&screen=${encodeURIComponent(s.id)}`;
    frame.src=url;frame.title=s.title;frame.loading='lazy';frame.width='360';frame.height='640';
    link.href=url;link.target='_blank';link.rel='noopener';link.textContent='Abrir pantalla ↗';
    card.append(tag,heading,frame,link);grid.append(card);
  });
}
select.addEventListener('change',render);render();
