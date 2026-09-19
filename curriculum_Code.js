// ===========================================================
//  THE OPERATOR - Curriculum database
//  A per-track study checklist: what is done, what is left,
//  and what is next. Lives on its own tab of "The Operator Log".
// ===========================================================

var CURRICULUM_SHEET   = 'Curriculum';
var CURRICULUM_HEADERS = ['Track','Seq','Group','Chapter','Item','Pages','StartPage','Status','DoneOn'];
var CURRICULUM_COLS    = CURRICULUM_HEADERS.length;

// Seed data - [group, chapter, item, pages, startPage] in study order.
// Generated from the `sections` array in tcm_sk_study_plan_v3.html: chapters
// that have subsections contribute one row per subsection, chapters without
// contribute one row themselves. 72 leaf rows, 699 pages.
// (Chapter-level page counts sum to 737; the TCM subsection counts do not
// cover every page of their chapters, so the leaf total is lower.)
// ── EXAMPLE SEED DATA ────────────────────────────────────────────────────────
// The real project seeds ~186 rows across four tracks from published course
// syllabi. That data is third-party content, so this public copy ships a short
// example instead. The shape is identical, so the seeders below work unchanged.
//
// Row format: [ Group, Chapter, Item, Size, StartPage ]
//   Size is PAGES for a book-based track and HOURS for a course-based one —
//   same column, different unit, resolved in the UI by curUnit().
//   Item may be blank, in which case the chapter itself is the leaf row.

var CCP_CURRICULUM = [
  ['Section 1: Cost',        'Ch 1: Cost Elements',            '1.1 Direct and indirect costs', 14, 1],
  ['Section 1: Cost',        'Ch 1: Cost Elements',            '1.2 Fixed and variable costs',  11, 15],
  ['Section 1: Cost',        'Ch 2: Pricing',                  '',                              22, 26],
  ['SK Section 1: Cost',     'SK Ch 1: Cost Engineering',      '',                              18, 1],
  ['SK Section 1: Cost',     'SK Ch 2: Estimating',            '',                              25, 19],
  ['SK Section 2: Planning', 'SK Ch 3: Schedule Development',  '',                              31, 44]
];

var GOOGLE_CURRICULUM = [
  ['Course 1: Foundations',  'Module 1: Introduction',         '', 5, 0],
  ['Course 1: Foundations',  'Module 2: Core Concepts',        '', 6, 0],
  ['Course 2: Preparation',  'Module 1: Data Types',           '', 4, 0]
];

var IBM_CURRICULUM = [
  ['Course 1: Fundamentals', 'Module 1: What Is Data?',        '', 4, 0],
  ['Course 1: Fundamentals', 'Module 2: Sources and Formats',  '', 5, 0],
  ['Course 2: Tools',        'Module 1: Spreadsheets',         '', 6, 0]
];

// Item detail for one module, keyed by seq. Fetched on demand by
// getModuleItems() so a large store never rides along on getCurriculum().
// Format: [ title, minutes, kind ] where kind is v)ideo r)ead a)ssessment x)task
var IBM_ITEMS = {
  1: [['Welcome to the course',            2, 'v'],
      ['What is data analysis?',           7, 'v'],
      ['Reading: the data ecosystem',     10, 'r'],
      ['Practice quiz',                    8, 'a'],
      ['Hands-on: load a dataset',        25, 'x']],
  2: [['Structured vs unstructured',       9, 'v'],
      ['Reading: file formats',           12, 'r'],
      ['Graded quiz',                     15, 'a']]
};

var PY4E_CURRICULUM = [
  ['PY4E Course 1: Getting Started', 'Ch 1: Why Program?',     '', 4, 0],
  ['PY4E Course 1: Getting Started', 'Ch 2: Variables',        '', 3, 0],
  ['PY4E Course 2: Data Structures', 'Ch 6: Strings',          '', 5, 0]
];

var PY4E_ITEMS = {
  1: [['Installing Python',                6, 'v'],
      ['Reading: chapter 1',              20, 'r'],
      ['Chapter 1 quiz',                  10, 'a']]
};

var AIEFS_CURRICULUM = [
  ['AIEFS Phase 0: Setup',    'Environment and tooling',       '', 6, 0],
  ['AIEFS Phase 1: Python',   'Idiomatic Python for ML',       '', 20, 0]
];

function _curriculumSheet() {
  var ss    = getSheet().getParent();
  var sheet = ss.getSheetByName(CURRICULUM_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CURRICULUM_SHEET);
    sheet.appendRow(CURRICULUM_HEADERS);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(3, 240);
    sheet.setColumnWidth(4, 300);
    sheet.setColumnWidth(5, 280);
  }
  var max = sheet.getMaxColumns();
  if (max < CURRICULUM_COLS) sheet.insertColumnsAfter(max, CURRICULUM_COLS - max);

  var hdr   = sheet.getRange(1, 1, 1, CURRICULUM_COLS).getValues()[0];
  var stale = false;
  for (var i = 0; i < CURRICULUM_COLS; i++) {
    if (String(hdr[i] || '') !== CURRICULUM_HEADERS[i]) { stale = true; break; }
  }
  if (stale) {
    sheet.getRange(1, 1, 1, CURRICULUM_COLS).setValues([CURRICULUM_HEADERS])
      .setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF');
  }
  return sheet;
}

// Return the whole curriculum, in sheet order.
function getCurriculum() {
  try {
    var sheet = _curriculumSheet();
    var data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return JSON.stringify([]);

    var out = [];
    for (var i = 1; i < data.length; i++) {
      try {
        var r = data[i];
        if (!String(r[0] || '')) continue;          // skip blank rows
        out.push({
          track:     String(r[0]),
          seq:       Number(r[1]),
          group:     String(r[2] || ''),
          chapter:   String(r[3] || ''),
          item:      String(r[4] || ''),
          pages:     Number(r[5]) || 0,
          startPage: Number(r[6]) || 0,
          done:      String(r[7] || '') === 'done',
          doneOn:    r[8] ? _toIso(r[8]) : ''
        });
      } catch(rowErr) {
        Logger.log('getCurriculum: skipped bad row ' + (i + 1) + ' - ' + rowErr.message);
      }
    }
    return JSON.stringify(out);
  } catch(e) {
    Logger.log('getCurriculum error: ' + e.message);
    return JSON.stringify([]);
  }
}

// Mark one or many items done / not-done.
// Payload: { track: 'CCP', seqs: [1,2,3], done: true }
// Batched on purpose - "mark everything up to here" is a single call, and the
// status column is written once rather than once per row.
function setCurriculumDone(json) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p     = JSON.parse(json);
    var track = String(p.track || '');
    var done  = !!p.done;
    var want  = {};
    (p.seqs || []).forEach(function(s) { want[Number(s)] = true; });

    var sheet = _curriculumSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return JSON.stringify({ success: true, updated: 0 });

    var vals  = sheet.getRange(2, 1, last - 1, CURRICULUM_COLS).getValues();
    var today = _todayStr();
    var n     = 0;

    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== track) continue;
      if (!want[Number(vals[i][1])]) continue;
      vals[i][7] = done ? 'done' : '';
      vals[i][8] = done ? today  : '';
      n++;
    }
    if (n) {
      sheet.getRange(2, 8, vals.length, 2).setValues(vals.map(function(r) {
        return [r[7], r[8]];
      }));
    }
    return JSON.stringify({ success: true, updated: n });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Seed one track. Idempotent: refuses if that track already has rows, so a
// second run cannot duplicate a syllabus.
// opts.prefix   - only rows whose Group starts with this count as "already
//                 seeded", so a second body can be appended to the same track.
// opts.startSeq - the seq this body must begin at; refused if the track does
//                 not already hold exactly startSeq-1 rows, which keeps the
//                 item-store keys aligned with their rows.
function _seedTrack(track, data, opts) {
  opts = opts || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = _curriculumSheet();
    var rows  = sheet.getDataRange().getValues();
    var count = 0, maxSeq = 0;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) !== track) continue;
      count++;
      maxSeq = Math.max(maxSeq, Number(rows[i][1]) || 0);
      var g = String(rows[i][2] || '');
      if (!opts.prefix || g.indexOf(opts.prefix) === 0) {
        Logger.log('_seedTrack: ' + track + (opts.prefix ? ' / ' + opts.prefix : '') +
                   ' rows already present - refusing to duplicate.');
        return JSON.stringify({ success: false, error: 'already seeded' });
      }
    }
    if (opts.startSeq && maxSeq !== opts.startSeq - 1) {
      Logger.log('_seedTrack: expected ' + (opts.startSeq - 1) + ' existing ' + track +
                 ' rows before this body, found ' + maxSeq + '. Seed the earlier one first.');
      return JSON.stringify({ success: false, error: 'wrong seed order' });
    }
    var base = (opts.startSeq || 1) - 1;
    var out = data.map(function(r, idx) {
      return [track, base + idx + 1, r[0], r[1], r[2], r[3], r[4], '', ''];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, out.length, CURRICULUM_COLS).setValues(out);
    Logger.log('_seedTrack: wrote ' + out.length + ' ' + track + ' rows.');
    return JSON.stringify({ success: true, rows: out.length });
  } catch(e) {
    Logger.log('_seedTrack error: ' + e.message);
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Run each ONCE from the Apps Script editor.
function seedCurriculumCCP()    { return _seedTrack('CCP',    CCP_CURRICULUM); }
function seedCurriculumGoogle() { return _seedTrack('Google', GOOGLE_CURRICULUM); }
function seedCurriculumIBM()    { return _seedTrack('IBM',    IBM_CURRICULUM); }
function seedCurriculumPY4E()   { return _seedTrack('AI',     PY4E_CURRICULUM); }
// Run AFTER seedCurriculumPY4E - it appends onto the AI track after the PY4E rows.
function seedCurriculumAIEFS()  {
  return _seedTrack('AI', AIEFS_CURRICULUM, { prefix: 'AIEFS', startSeq: PY4E_CURRICULUM.length + 1 });
}

// Tracks that carry item detail. Keys must stay aligned with the row seqs, so a
// second body appended to a track has to start after the first one ends.
var ITEM_STORE = { IBM: IBM_ITEMS, AI: PY4E_ITEMS };

// Items for one module, on demand. Keeps the main getCurriculum() payload small
// - 764 rows would otherwise ride along on every load.
function getModuleItems(json) {
  try {
    var p = JSON.parse(json);
    var store = ITEM_STORE[String(p.track)];
    if (!store) return JSON.stringify([]);
    var list = store[String(p.seq)] || [];
    return JSON.stringify(list.map(function(r) {
      return { title: r[0], mins: r[1], kind: r[2] };
    }));
  } catch(e) {
    Logger.log('getModuleItems error: ' + e.message);
    return JSON.stringify([]);
  }
}

