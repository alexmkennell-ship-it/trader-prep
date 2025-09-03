const test = require('node:test');
const assert = require('node:assert').strict;

function ctHourMinute(d){
  try{
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone:'America/Chicago',
      hour12:false,
      weekday:'short',
      hour:'2-digit',
      minute:'2-digit'
    }).formatToParts(d);
    let hh=0, mm=0, wd='Sun';
    for(const p of parts){
      if(p.type==='hour') hh = parseInt(p.value,10);
      if(p.type==='minute') mm = parseInt(p.value,10);
      if(p.type==='weekday') wd = p.value;
    }
    const map={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
    return {hh, mm, day:map[wd]};
  }catch(_){ return {hh:d.getHours(), mm:d.getMinutes(), day:d.getDay()}; }
}

function isTopstepOpen(d){
  const {hh, mm, day} = ctHourMinute(d||new Date());
  if(day === 6) return false;
  if(day === 0 && hh < 17) return false;
  if(day === 5 && (hh>15 || (hh===15 && mm>=10))) return false;
  const closed = ((hh>15 || (hh===15 && mm>=10)) && hh<17);
  return !closed;
}

test('closed on Saturday', () => {
  const dt = new Date('2024-06-15T18:00:00Z'); // Saturday 13:00 CT
  assert.equal(isTopstepOpen(dt), false);
});

test('closed on Sunday before 5pm CT', () => {
  const dt = new Date('2024-06-16T21:00:00Z'); // Sunday 16:00 CT
  assert.equal(isTopstepOpen(dt), false);
});

test('open on Sunday after 5pm CT', () => {
  const dt = new Date('2024-06-16T23:00:00Z'); // Sunday 18:00 CT
  assert.equal(isTopstepOpen(dt), true);
});

test('closed during daily break', () => {
  const dt = new Date('2024-06-18T20:30:00Z'); // Tuesday 15:30 CT
  assert.equal(isTopstepOpen(dt), false);
});

test('closed Friday after 3:10pm CT', () => {
  const dt = new Date('2024-06-21T21:30:00Z'); // Friday 16:30 CT
  assert.equal(isTopstepOpen(dt), false);
});

test('open during regular hours', () => {
  const dt = new Date('2024-06-18T18:00:00Z'); // Tuesday 13:00 CT
  assert.equal(isTopstepOpen(dt), true);
});

