// Structural verification for Index.html after a refactor that removes elements.
// The one that matters most: every id the script asks for must exist in the markup.
var fs = require('fs');
var src = fs.readFileSync(require('path').join(__dirname, '..', 'Index.html'), 'utf8');
var fail = 0;
function ok(cond, label, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  -> ' + detail : ''));
  if (!cond) fail++;
}

var css  = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
var body = src.slice(src.indexOf('<body>'), src.lastIndexOf('<script>'));
var js   = src.slice(src.lastIndexOf('<script>') + 8, src.lastIndexOf('</script>'));

console.log('\n-- parses --');
var parseErr = null;
try { new Function(js); } catch (e) { parseErr = e.message; }
ok(!parseErr, 'main script block parses', parseErr || (js.split('\n').length + ' lines'));

console.log('\n-- balance --');
var dOpen = (src.match(/<div[\s>]/g) || []).length, dClose = (src.match(/<\/div>/g) || []).length;
ok(dOpen === dClose, 'divs balanced', dOpen + ' / ' + dClose);
ok(css.split('{').length === css.split('}').length, 'CSS braces balanced',
   (css.split('{').length - 1) + ' / ' + (css.split('}').length - 1));

console.log('\n-- every id the script references exists in the markup --');
var ids = {};
(body.match(/\sid="([^"]+)"/g) || []).forEach(function (m) { ids[m.replace(/.*id="/, '').replace('"', '')] = 1; });
var refs = {};
(js.match(/getElementById\('([^']+)'\)/g) || []).forEach(function (m) { refs[m.slice(16, -2)] = 'getElementById'; });
(js.match(/querySelector(All)?\('#([A-Za-z0-9_-]+)/g) || []).forEach(function (m) { refs[m.replace(/.*#/, '')] = 'querySelector'; });
(body.match(/querySelector(All)?\('#([A-Za-z0-9_-]+)/g) || []).forEach(function (m) { refs[m.replace(/.*#/, '')] = 'inline querySelector'; });
var missing = Object.keys(refs).filter(function (id) { return !ids[id]; });
ok(missing.length === 0, Object.keys(refs).length + ' referenced ids all present', missing.length ? 'MISSING: ' + missing.join(', ') : '');

console.log('\n-- every inline onclick handler is defined --');
var fns = {};
(js.match(/function\s+([A-Za-z0-9_$]+)\s*\(/g) || []).forEach(function (m) { fns[m.replace(/function\s+/, '').replace(/\s*\($/, '')] = 1; });
var handlers = {};
(body.match(/onclick="([A-Za-z0-9_$]+)\(/g) || []).forEach(function (m) { handlers[m.slice(9, -1)] = 1; });
var undef = Object.keys(handlers).filter(function (f) { return !fns[f]; });
ok(undef.length === 0, Object.keys(handlers).length + ' onclick handlers all defined', undef.length ? 'UNDEFINED: ' + undef.join(', ') : '');

console.log('\n-- retired things are really gone --');
['non-neg', 'one-task', 'daily-note', 'review-reflection', 'review-takeaway', 'review-save-btn',
 'session-track-pills', 'task-track-pills', 'review-commitments-list'].forEach(function (id) {
  ok(!ids[id] && !refs[id], 'no trace of #' + id);
});
['buildReview', 'collectReview', 'saveReviewToSheets', 'setRealistic', 'renderTrackPills'].forEach(function (f) {
  ok(!fns[f] && js.indexOf(f + '(') < 0, 'no trace of ' + f + '()');
});
ok(src.indexOf('maximum-scale') < 0, 'pinch-zoom not disabled');
ok(src.indexOf('color:#484f58') < 0, 'no 2.4:1 grey used as a text colour');
ok(src.indexOf("content:'¹3'") < 0 && src.indexOf("content:'\\2713'") >= 0, 'curriculum tick is a real checkmark');
ok(src.indexOf('06:31') < 0, 'no stale 06:31');
ok(src.indexOf('Dawn Block') < 0, 'no stale "Dawn Block"');

console.log('\n-- shape --');
var tabs = (body.match(/class="tab(?: active)?" data-tab=/g) || []).length;
var side = (body.match(/class="sidebar-nav-item(?: active)?" data-tab=/g) || []).length;
ok(tabs === 5 && side === 5, 'five tabs, five sidebar items', tabs + ' / ' + side);
function section(id) {
  var i = body.indexOf('id="' + id + '" class="section');
  var j = body.indexOf('class="section"', i + 40);
  return body.slice(i, j < 0 ? body.length : j);
}
var mChecks = (section('morning').match(/class="check-item/g) || []).length;
var eChecks = (section('evening').match(/class="check-item/g) || []).length;
var eAuto   = (section('evening').match(/class="check-item auto"/g) || []).length;
ok(mChecks === 4, 'morning has 4 boot steps (log array shape unchanged)', mChecks);
ok(eChecks === 5 && eAuto === 4, 'evening has 5 steps, 4 derived (log array shape unchanged)', eChecks + ' / ' + eAuto);
ok(section('log').indexOf('id="l4-metrics"') >= 0, 'Sunday review lives on the Score tab');
ok(src.indexOf('VMP') < 0, 'no legacy VMP values block');
ok(section('track').indexOf('id="commitments-list"') < section('track').indexOf('id="session-state-row"'),
   'commitments sit above the session form on Engine');
ok(section('evening').indexOf('id="evening-commits"') >= 0 && section('evening').indexOf('id="miss-note"') >= 0 &&
   section('evening').indexOf('id="tomorrow-plan"') >= 0 && section('evening').indexOf('id="verdict"') >= 0,
   'evening holds commits, miss note, tomorrow, verdict');
var textIds = (js.match(/var TEXT_IDS = \[([^\]]+)\]/) || [, ''])[1].replace(/['\s]/g, '').split(',');
ok(textIds.length === 6 && textIds.every(function (id) { return ids[id]; }), 'TEXT_IDS all exist in markup', textIds.join(','));

console.log('\n-- phone text floor --');
var phone = css.slice(css.indexOf('@media (max-width:480px)'));
var small = phone.match(/font-size:\s*(9|10|11)px/g) || [];
ok(small.length <= 2, 'phone media block: text at 9-11px', small.length + ' (header h1 wordmark is allowed)');
var base = css.slice(0, css.indexOf('@media (min-width:900px)'));
var smallBase = [];
base.replace(/([^{}]+)\{([^{}]*)\}/g, function (_, sel, decl) {
  var m = decl.match(/font-size:\s*(9|10|11)px/);
  if (m) smallBase.push(sel.trim().split('\n').pop().trim() + ' ' + m[0]);
  return _;
});
ok(smallBase.length <= 2, 'base rules with text at 9-11px', smallBase.join(' | ') || 'none');

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'All structural checks passed.'));
process.exit(fail ? 1 : 0);
