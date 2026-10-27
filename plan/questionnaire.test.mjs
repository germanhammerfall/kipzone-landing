import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA,TTL,createDraft,historyDates,stepsFor,validateStep,assessDraft,toHandoff,decodeSaved,clockSeconds,dateKey} from './questionnaire.mjs';

function complete(){
  const d=createDraft();
  d.answers={goal:'fiveK',experience:'regular',adult:'yes',noPain:'yes',noSymptoms:'yes',currentDays:'4',currentMinutes:'280',currentWeeklyKm:'40',longestRunKm:'14',interruptionDays:'1',weeklySessions:'4',availableDays:[1,3,5,7],availableMinutes:'280',dayLimitMinutes:'90',longRunDay:'7',startDate:dateKey(new Date()),weeks:'12',hasRace:'no',hasReference:'no'};
  for(let i=0;i<4;i++)d.answers[`history${i}`]={status:'trained',minutes:'280',days:'4',qualityMinutes:'30',tolerated:'yes'};
  return d;
}
const validate=(id,d)=>validateStep(stepsFor(d).find(s=>s.id===id),d);

test('complete profile only passes preliminary review and never creates a plan',()=>{
  const d=complete();assert.equal(assessDraft(d).status,'readyForReview');
  const data=toHandoff(d);assert.equal(data.planGenerated,false);assert.equal(data.requiresEngineValidation,true);assert.equal(data.recentRace,null);
  assert.ok(!Object.hasOwn(data,'sessions'));
});
test('no-reference route does not ask for a race result',()=>{const d=complete();assert.ok(!stepsFor(d).some(s=>s.id==='reference'));d.answers.hasReference='yes';assert.ok(stepsFor(d).some(s=>s.id==='reference'));assert.ok(validate('reference',d));});
test('race date is conditional and independent of programme end',()=>{
  const d=complete();assert.ok(!stepsFor(d).some(s=>s.id==='raceDate'));
  d.answers.hasRace='yes';assert.ok(validate('raceDate',d));
  d.answers.raceDate=d.answers.startDate;assert.equal(validate('raceDate',d),'');
  d.answers.raceDate='2100-01-01';assert.ok(validate('raceDate',d));
  d.answers.hasRace='no';assert.equal(toHandoff(d).configuration.raceDate,null);
});
test('a removed reference is not exported from stale hidden data',()=>{const d=complete();d.answers.reference={distance:'5',time:'25:00',date:'2026-01-01'};assert.equal(toHandoff(d).recentRace,null);});
test('history dates are completed consecutive Monday–Sunday windows',()=>{
  assert.deepEqual(historyDates(new Date(2026,9,27)),[
    {start:'2026-09-28',end:'2026-10-04'},{start:'2026-10-05',end:'2026-10-11'},
    {start:'2026-10-12',end:'2026-10-18'},{start:'2026-10-19',end:'2026-10-25'}]);
  assert.equal(historyDates(new Date(2026,10,2))[3].end,'2026-11-01');
});
test('unknown history stays null and cannot pass review',()=>{
  const d=complete();d.answers.history2={status:'unknown'};
  assert.equal(assessDraft(d).status,'incomplete');assert.deepEqual(assessDraft(d).stepIds,['history2']);
  assert.equal(toHandoff(d).history[2].minutes,null);
});
test('missing tolerance is never exported as a negative answer',()=>{const d=complete();delete d.answers.history0.tolerated;assert.equal(toHandoff(d).history[0].tolerated,null);assert.equal(assessDraft(d).status,'incomplete');});
test('a starting goal is preserved even without a supported goal enum',()=>{const d=complete();d.answers.goal='startRunning';const data=toHandoff(d);assert.equal(data.configuration.goal,null);assert.equal(data.declaredGoal,'startRunning');});
test('confirmed no training exports zero but does not reuse old figures',()=>{
  const d=complete();d.answers.history0={status:'noTraining',minutes:'300',days:'5'};
  const w=toHandoff(d).history[0];assert.equal(w.minutes,0);assert.equal(w.days,0);assert.equal(w.qualityMinutes,0);
});
test('history uses median rather than replacing it with desired availability',()=>{
  const d=complete();[230,240,360,390].forEach((v,i)=>d.answers[`history${i}`].minutes=String(v));
  d.answers.availableMinutes='600';assert.equal(assessDraft(d).medianMinutes,300);
});
for(const [key,value]of [['adult','no'],['noPain','no'],['noSymptoms','no'],['noSymptoms','unknown'],['experience','starting'],['goal','wellbeing'],['goal','returnToRunning'],['goal','startRunning']]){
  test(`${key}=${value} ends outside current scope`,()=>{const d=complete();d.answers[key]=value;assert.equal(assessDraft(d).status,'outsideScope');});
}
test('missing safety confirmation cannot pass as false or as consent',()=>{const d=complete();delete d.answers.adult;assert.equal(assessDraft(d).status,'incomplete');assert.equal(toHandoff(d).confirmations.adult,null);});
test('two-week interruption fails preliminary scope',()=>{const d=complete();d.answers.interruptionDays='14';assert.equal(assessDraft(d).status,'outsideScope');});
test('at least three sessions must fit habitual days, desired maximum and availability',()=>{
  for(const change of [d=>d.answers.weeklySessions='2',d=>{d.answers.availableDays=[2,4];d.answers.longRunDay='none';},d=>{for(let i=0;i<4;i++)d.answers[`history${i}`].days='2';}]){
    const d=complete();change(d);assert.equal(assessDraft(d).status,'outsideScope');
  }
});
test('invalid weekly values are not silently clamped',()=>{
  const d=complete();d.answers.history0.qualityMinutes='281';assert.ok(validate('history0',d));
  d.answers.history0.qualityMinutes='30';d.answers.history0.tolerated='';assert.ok(validate('history0',d));
  d.answers.history0.tolerated='yes';d.answers.history0.days='4.5';assert.ok(validate('history0',d));
});
test('current frequency and time must agree and differ from future availability',()=>{
  const d=complete();d.answers.currentDays='0';assert.ok(validate('currentMinutes',d));
  d.answers.currentMinutes='0';assert.equal(validate('currentMinutes',d),'');
  assert.equal(toHandoff(d).availability.availableMinutes,280);assert.equal(toHandoff(d).configuration.currentMinutes,0);
});
test('distance optionals remain absent and longest run cannot exceed weekly km',()=>{
  const d=complete();d.answers.longestRunKm='41';assert.ok(validate('longestRunKm',d));
  d.answers.currentWeeklyKm='';d.answers.longestRunKm='';assert.equal(validate('longestRunKm',d),'');assert.equal(toHandoff(d).configuration.longestRunKm,null);
});
test('reference accepts one completed race, validates time and date',()=>{
  const d=complete();d.answers.hasReference='yes';d.answers.reference={distance:'5',time:'25:30',date:'2026-01-01'};
  assert.equal(validate('reference',d),'');assert.equal(toHandoff(d).recentRace.seconds,1530);
  d.answers.reference.date='2100-01-01';assert.ok(validate('reference',d));
  d.answers.reference.date='2026-02-30';assert.ok(validate('reference',d));
});
test('clock input does not treat decimals as minutes or normalize invalid seconds',()=>{
  assert.equal(clockSeconds('25:30'),1530);assert.equal(clockSeconds('1:03:05'),3785);
  for(const value of ['25.5','0:00','1:60','1:99:30','x',''])assert.equal(clockSeconds(value),null);
});
test('dates are calendar values; next week forces history refresh',()=>{
  const d=complete();d.historyWindows=historyDates(new Date(2020,0,1));assert.equal(assessDraft(d).status,'stale');
});
test('long-run preference must belong to available days',()=>{const d=complete();d.answers.longRunDay='2';assert.ok(validate('longRunDay',d));d.answers.longRunDay='none';assert.equal(validate('longRunDay',d),'');});
test('saved data has seven-day TTL and rejects incompatible or malformed content',()=>{
  const d=complete(),now=Date.now(),raw=JSON.stringify({schemaVersion:SCHEMA,savedAt:now,draft:d});
  assert.deepEqual(decodeSaved(raw,now),d);assert.equal(decodeSaved(raw,now+TTL+1),null);
  for(const raw of ['{','null',JSON.stringify({schemaVersion:100}),JSON.stringify({schemaVersion:SCHEMA,savedAt:now,draft:{...d,answers:{availableDays:'1'}}})])assert.equal(decodeSaved(raw,now),null);
});
