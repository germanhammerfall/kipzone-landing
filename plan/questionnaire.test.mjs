import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA,TTL,createDraft,stepsFor,validateStep,pruneAnswers,decodeSaved,dateKey,clockSeconds} from './questionnaire.mjs';
const ids=d=>stepsFor(d).map(s=>s.id);
function make(goal='improve'){const d=createDraft();d.answers={goal,distance:'5',units:'km',experience:'intermediate',hasReference:'no',currentWeeklyMileage:'30',currentLongestRun:'12',runsPerWeek:'3',availableDays:[1,3,6],longRunDay:'6',startDate:dateKey(new Date()),weeks:'12'};return d;}
const validate=(id,d)=>validateStep(stepsFor(d).find(s=>s.id===id),d);
test('regular route has direct questions without motor-specific gates or history',()=>{const d=make();assert.ok(stepsFor(d).every(s=>!validateStep(s,d)));for(const id of ['adult','noPain','history0','availableMinutes','dayLimitMinutes'])assert.ok(!ids(d).includes(id));});
test('beginner level does not stop the UI prototype',()=>{const d=make();d.answers.experience='beginner';assert.equal(validate('experience',d),'');assert.ok(ids(d).includes('runsPerWeek'));});
for(const goal of ['startRunning','returnToRunning'])test(`${goal} uses an independent Foundation-inspired route without race marks`,()=>{const d=make(goal),s=ids(d);assert.ok(s.includes('exerciseLevel'));assert.ok(s.includes('exerciseFrequency'));for(const id of ['experience','hasReference','referenceTime','currentWeeklyMileage','longRunDay'])assert.ok(!s.includes(id));});
test('Foundation return captures months away rather than silently converting days',()=>{const d=make('returnToRunning');assert.ok(ids(d).includes('monthsSinceLastRun'));d.answers.monthsSinceLastRun='6';assert.equal(validate('monthsSinceLastRun',d),'');});
test('general running does not require a target distance',()=>{const d=make('wellbeing');assert.ok(!ids(d).includes('distance'));assert.ok(ids(d).includes('weeks'));});
test('a selected race replaces programme length, without renaming its date',()=>{const d=make('race');d.answers.hasRace='yes';assert.ok(ids(d).includes('raceDate'));assert.ok(ids(d).includes('raceName'));assert.ok(!ids(d).includes('weeks'));d.answers.hasRace='no';assert.ok(ids(d).includes('weeks'));assert.ok(!ids(d).includes('raceDate'));});
test('one current performance reference is optional; no result date is invented',()=>{const d=make();assert.ok(!ids(d).includes('referenceTime'));d.answers.hasReference='yes';assert.ok(ids(d).includes('referenceDistance'));assert.ok(ids(d).includes('referenceTime'));assert.ok(!ids(d).includes('referenceDate'));});
test('switching programmes removes hidden branch answers',()=>{const d=make();d.answers.hasReference='yes';d.answers.referenceDistance='5';d.answers.referenceTime='25:00';d.answers.goal='startRunning';pruneAnswers(d);assert.ok(!Object.hasOwn(d.answers,'referenceTime'));assert.ok(!Object.hasOwn(d.answers,'distance'));assert.equal(d.answers.runsPerWeek,'3');});
test('removing race selection clears its hidden date and name',()=>{const d=make('race');d.answers.hasRace='no';d.answers.raceName='Prueba';d.answers.raceDate='2027-01-01';pruneAnswers(d);assert.ok(!Object.hasOwn(d.answers,'raceDate'));assert.ok(!Object.hasOwn(d.answers,'raceName'));});
test('custom distance appears only for appropriate selections',()=>{const d=make();assert.ok(!ids(d).includes('customDistance'));d.answers.distance='custom';assert.ok(ids(d).includes('customDistance'));d.answers.customDistance='0';assert.ok(validate('customDistance',d));d.answers.customDistance='7.5';assert.equal(validate('customDistance',d),'');});
test('ultra input does not accept a sub-marathon distance',()=>{const d=make();d.answers.distance='ultra';d.answers.customDistance='30';assert.ok(validate('customDistance',d));});
test('current load and desired frequency remain distinct',()=>{const d=make();d.answers.currentWeeklyMileage='15';d.answers.currentLongestRun='18';assert.ok(validate('currentLongestRun',d));d.answers.currentWeeklyMileage='';assert.equal(validate('currentWeeklyMileage',d),'');assert.equal(d.answers.runsPerWeek,'3');});
test('availability requires at least the requested number of running days',()=>{const d=make();d.answers.availableDays=[1,3];assert.ok(validate('availableDays',d));d.answers.availableDays=[1,3,6,7];assert.equal(validate('availableDays',d),'');});
test('availability edits clear an incompatible long-run preference',()=>{const d=make();d.answers.availableDays=[1,3,5];pruneAnswers(d);assert.equal(d.answers.longRunDay,'none');assert.equal(validate('longRunDay',d),'');});
test('start cannot follow the selected race',()=>{const d=make('race');d.answers.hasRace='yes';d.answers.raceDate='2098-01-01';d.answers.startDate='2099-01-01';assert.ok(validate('startDate',d));});
test('time inputs reject invented decimal interpretations and bad seconds',()=>{assert.equal(clockSeconds('25:30'),1530);assert.equal(clockSeconds('1:03:05'),3785);for(const v of ['25.5','1:60','0:00','x'])assert.equal(clockSeconds(v),null);});
test('approved editorial pauses leave question order and answers intact',()=>{const d=make(),before=structuredClone(d);const s=stepsFor(d);assert.equal(s.filter(x=>x.type==='editorial').length,3);assert.deepEqual(s.filter(x=>x.type!=='editorial').map(x=>x.id),stepsFor(d,[]).map(x=>x.id));assert.deepEqual(d,before);});
for(const goal of ['race','improve','wellbeing','startRunning','returnToRunning'])test(`${goal} sees three distinct pauses without duplicating conditional placement`,()=>{const d=make(goal),s=stepsFor(d),e=s.filter(x=>x.type==='editorial');assert.equal(e.length,3);assert.equal(new Set(s.map(x=>x.id)).size,s.length);assert.equal(s[1].id,'norwegian-achievements');assert.equal(e.filter(x=>x.id==='norwegian-principles').length,1);assert.ok(e.every(x=>validateStep(x,d)===''));});
test('editorial screens can be removed without removing any question',()=>{const d=make();assert.ok(stepsFor(d,[]).every(s=>s.type!=='editorial'));assert.ok(stepsFor(d,[]).some(s=>s.id==='availableDays'));});
test('saved UI drafts expire after seven days and do not load old engine contracts',()=>{const d=make();pruneAnswers(d);const now=Date.now(),raw=JSON.stringify({schemaVersion:SCHEMA,savedAt:now,draft:d});assert.deepEqual(decodeSaved(raw,now),d);assert.equal(decodeSaved(raw,now+TTL+1),null);assert.equal(decodeSaved(JSON.stringify({schemaVersion:1,savedAt:now,draft:d})),null);});
test('malformed drafts do not reach the renderer',()=>{for(const raw of ['null','{',JSON.stringify({schemaVersion:SCHEMA,savedAt:Date.now(),draft:{schemaVersion:SCHEMA,answers:{availableDays:'lunes'}}})])assert.equal(decodeSaved(raw),null);});

// The screen catalogue must use valid examples rather than unfinished forms.
const {scenarios,exampleDraft,screensFor}=await import('./preview-data.mjs');
for(const scenario of scenarios){
  test(`catalogue ${scenario.id} can reach a valid review and completion`,()=>{
    const draft=exampleDraft(scenario.id);
    for(const step of stepsFor(draft))assert.equal(validateStep(step,draft),'',step.id);
    const screens=screensFor(scenario.id);
    assert.equal(new Set(screens.map(s=>s.id)).size,screens.length);
    assert.equal(screens[0].id,'welcome');
    assert.equal(screens.at(-2).id,'review');
    assert.equal(screens.at(-1).id,'result');
  });
}
