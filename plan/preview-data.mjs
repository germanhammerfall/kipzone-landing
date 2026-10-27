// Review-only sample data. Never loaded by the public questionnaire.
import {createDraft,dateKey,stepsFor,pruneAnswers} from './questionnaire.mjs';
export const scenarios=[
  {id:'race',label:'Preparar una carrera'},
  {id:'improve',label:'Mejorar mi marca'},
  {id:'wellbeing',label:'Correr con constancia'},
  {id:'startRunning',label:'Empezar a correr'},
  {id:'returnToRunning',label:'Volver a correr'},
  {id:'custom',label:'Distancia personalizada'},
  {id:'noRace',label:'Carrera sin evento elegido'}
];
export function exampleDraft(id='race',now=new Date()){
  const start=new Date(now),race=new Date(now);start.setDate(start.getDate()+7);race.setDate(race.getDate()+91);
  const draft=createDraft();
  draft.answers={goal:['custom','noRace'].includes(id)?'race':scenarios.some(s=>s.id===id)?id:'race',distance:id==='custom'?'custom':'10',customDistance:'15',hasRace:id==='noRace'?'no':'yes',raceName:'Carrera de ejemplo',raceDate:dateKey(race),units:'km',experience:'intermediate',hasReference:'yes',referenceDistance:'5',referenceTime:'25:30',currentWeeklyMileage:'25',currentLongestRun:'10',exerciseLevel:'moderate',exerciseFrequency:'3',monthsSinceLastRun:'6',runsPerWeek:'3',availableDays:[1,3,6],longRunDay:'6',startDate:dateKey(start),weeks:'12'};
  pruneAnswers(draft);return draft;
}
export function screensFor(id){
  return [{id:'welcome',title:'Bienvenida',type:'welcome'},...stepsFor(exampleDraft(id)),{id:'review',title:'Revisión de respuestas',type:'review'},{id:'result',title:'Cuestionario completado',type:'result'}];
}
