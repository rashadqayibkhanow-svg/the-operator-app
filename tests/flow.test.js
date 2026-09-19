// The simplified daily flow, against the real functions pulled out of Index.html.
var fs = require('fs');
var src = fs.readFileSync(require('path').join(__dirname, '..', 'Index.html'), 'utf8');
var js = src.slice(src.lastIndexOf('<script>') + 8, src.lastIndexOf('</script>'));

function grab(name) {
  var i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  var d = 0;
  for (var k = js.indexOf('{', i); k < js.length; k++) {
    if (js[k] === '{') d++;
    else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); }
  }
}

// Fri 2026-09-18
var TODAY = new Date(2026, 8, 18);
var RealDate = Date;
global.Date = function (a, b, c) {
  if (arguments.length === 0) return new RealDate(TODAY.getTime());
  if (arguments.length === 1) return new RealDate(a);
  return new RealDate(a, b, c);
};
global.Date.prototype = RealDate.prototype;
global.Date.now = function () { return TODAY.getTime(); };

function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
global.isoDate = isoDate;
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
// A tiny DOM: named elements with value/text/style/className, nothing else.
var dom = {};
function el(id) { return dom[id] || (dom[id] = { id: id, value: '', textContent: '', className: '', style: {} }); }
global.document = { getElementById: function (id) { return el(id); }, querySelectorAll: function () { return []; } };
global.autoGrow = function () {};
global.cachedLog = null;

eval(js.slice(js.indexOf('var LOCK_START'), js.indexOf(';', js.indexOf('var LOCK_START')) + 1));
eval(js.slice(js.indexOf('var CKEYS'), js.indexOf(';', js.indexOf('var CDEFAULT')) + 1));
eval(grab('activeKeys'));
eval(grab('eveningAuto'));
eval(grab('renderEveningChecks'));
eval(grab('todayTaskName'));
eval(grab('renderTodayTask'));
eval(grab('prefillTomorrow'));
eval(grab('hidePrefillHint'));
eval(grab('_dayCounted'));
eval(grab('calcStreak'));
eval(grab('weekStats'));
eval(grab('parseCalis'));
eval(grab('calisNextSession'));

var fail = 0;
function check(label, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + '  -> ' + JSON.stringify(got) + (ok ? '' : '  (expected ' + JSON.stringify(want) + ')'));
}
function reset() { store = {}; dom = {}; }
function day(off, patch) {
  var x = new RealDate(TODAY.getTime()); x.setDate(x.getDate() - off);
  var e = { date: isoDate(x), commitments: [], session: {} };
  Object.keys(patch || {}).forEach(function (k) { e[k] = patch[k]; });
  return e;
}

console.log('\n-- the four derived shutdown ticks --');
reset();
check('empty day: only "root cause" is satisfied (nothing to write)', eveningAuto(), [false, true, false, false]);
store.op_c1_status = 'D'; store.op_c2_status = 'M';
check('two of three marked is not "every commitment marked"', eveningAuto()[0], false);
store.op_c3_status = 'D';
check('all three marked', eveningAuto()[0], true);
store.op_c3_status = 'X';
check('an X with no root cause: tick 2 drops', eveningAuto()[1], false);
store['op_miss-note'] = 'Rotavirus';
check('an X with a root cause: tick 2 back', eveningAuto()[1], true);
store['op_tomorrow-plan'] = '   ';
check('whitespace-only plan does not count', eveningAuto()[2], false);
store['op_tomorrow-plan'] = '1. SK CH6';
store['op_session-stopped'] = 'SK CH6 - stopped at residual values';
check('plan and stop point both present', eveningAuto().slice(2), [true, true]);

console.log('\n-- commitment #1 is the non-negotiable --');
reset();
check('placeholder is not a task', todayTaskName(), '');
store.op_c1 = CDEFAULT[0];
check('the default label is not a task either', todayTaskName(), '');
store.op_c1 = 'SK CH6 - residual values';
check('a real name is', todayTaskName(), 'SK CH6 - residual values');
renderTodayTask();
check('morning display shows it', [el('today-task').textContent, el('today-task').className], ['SK CH6 - residual values', 'task-display']);
store.op_c1 = '';
renderTodayTask();
check('and says so when empty', el('today-task').className, 'task-display empty');

console.log('\n-- tomorrow line 1 seeds from "where I stopped" --');
reset();
store['op_session-stopped'] = 'SK CH6 - Stopped at Trade Data/Cost Adjustments\nsecond line ignored';
prefillTomorrow();
check('empty plan + stop point -> line 1', store['op_tomorrow-plan'], '1. SK CH6 - Stopped at Trade Data/Cost Adjustments');
check('the textarea shows it', el('tomorrow-plan').value, '1. SK CH6 - Stopped at Trade Data/Cost Adjustments');
check('the hint is visible', el('prefill-hint').style.display, '');
store['op_tomorrow-plan'] = '1. PY4E quiz';
prefillTomorrow();
check('a plan already written is never overwritten', store['op_tomorrow-plan'], '1. PY4E quiz');
reset();
prefillTomorrow();
check('no stop point -> nothing seeded', store['op_tomorrow-plan'] === undefined, true);
store['op_tomorrow-plan'] = '';
store['op_session-stopped'] = '   ';
prefillTomorrow();
check('whitespace stop point -> nothing seeded', store['op_tomorrow-plan'], '');

console.log('\n-- one definition of an active day --');
var floorOnly = day(1, { session: { state: 'floor', saved: 'x' }, commitments: [{ status: '' }] });
var dmOnly    = day(1, { commitments: [{ status: 'M' }] });
var nothing   = day(1, { commitments: [{ status: 'X' }] });
check('floor session, no D/M: counted', _dayCounted(floorOnly), true);
check('D/M, no session: counted', _dayCounted(dmOnly), true);
check('all X, no session: not counted', _dayCounted(nothing), false);
check('streak counts a floor-only day (was 0 before)', calcStreak([floorOnly]), 1);
check('streak counts a D/M day', calcStreak([dmOnly]), 1);
check('streak ignores an all-X day', calcStreak([nothing]), 0);
check('three consecutive mixed days', calcStreak([
  day(1, { session: { state: 'relocated' } }),
  day(2, { commitments: [{ status: 'M' }] }),
  day(3, { session: { state: 'floor' } })
]), 3);

console.log('\n-- untouched logic still holds --');
var w = weekStats([day(1, { session: { state: 'relocated', block: '13:00', saved: 'a', stayed: 'used' } })]);
check('13:00 counts as the second block', w.secondBlock, 1);
check('relocated counts as fired', w.fired, 1);
check('calisthenics alternation', calisNextSession([day(1, { calis: 'A|full|1' })]), 'B');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'All flow checks passed.'));
process.exit(fail ? 1 : 0);
