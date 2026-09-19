// ═══════════════════════════════════════════════════════════
//  THE OPERATOR — Google Apps Script backend
//  File: Code.gs  (fixed)
// ═══════════════════════════════════════════════════════════

var SS_NAME    = 'The Operator Log';
var SHEET_NAME = 'Log';
// The War Map is a separate monthly-calendar spreadsheet. Put its id here.
var WAR_MAP_ID = 'YOUR_WAR_MAP_SPREADSHEET_ID';

// ── LOG SCHEMA ────────────────────────────────────────────
// Columns 16-23 exist to record what the Daily Deep-Work Session (Template 02,
// Layer 3) requires of the daily row: did the minimum, what's saved, tomorrow's
// task and where I stopped. Layer 4's three metrics are computed from them.
// Col 14 now holds the Layer 6 evolution rung (was "Phase").
var HEADERS = [
  'Date','DateLabel','Level','Score','Total',
  'NonNeg','MissNote','TomorrowPlan','Verdict',
  'MorningChecks','EveningChecks','Commitments',
  'DailyNote','Rung','Review',
  'Session','Block','Stayed','Saved','StoppedAt','Track','Backlog','Pillar',
  'Feeling','Calis'
];
var COLS = HEADERS.length; // 25

// ── REMINDER CONFIG ───────────────────────────────────────
// Paste your /exec deployment URL below after deploying
var APP_URL  = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
var MY_EMAIL = 'you@example.com';

// ── HELPERS ───────────────────────────────────────────────
function _dateLabel(d) {
  var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function _todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _toIso(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

// Index into a getValues() array of the row for dateStr, or -1. Sheet row = i + 1.
function _findRow(data, dateStr) {
  for (var i = 1; i < data.length; i++) {
    if (_toIso(data[i][0]) === dateStr) return i;
  }
  return -1;
}

// True only once the day has been CLOSED OUT by saveEntry(). A row created by
// saveMorningChecks() or saveReview() exists from 7am onward but leaves Level
// blank — treating that as "saved" would suppress the evening reminder daily.
function _alreadySavedToday() {
  var today = _todayStr();
  var sheet = getSheet();
  var data  = sheet.getDataRange().getValues();
  var i = _findRow(data, today);
  return i >= 0 && String(data[i][2] || '') !== '';
}

// ── MORNING REMINDER — trigger in the 08:00 window ────────
function sendMorningReminder() {
  var today = _todayStr();
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('lastMorningReminder') === today) return;
  props.setProperty('lastMorningReminder', today);

  var dateStr = _dateLabel(new Date());
  var subject = 'OPERATOR — Morning Sequence · ' + dateStr;

  var html = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:480px;background:#0d1117;color:#e6edf3;border-radius:12px;padding:28px 24px;">',
    '  <div style="font-size:11px;letter-spacing:3px;color:#e8375a;text-transform:uppercase;margin-bottom:6px;">Personal OS</div>',
    '  <div style="font-size:22px;font-weight:800;margin-bottom:4px;">THE OPERATOR</div>',
    '  <div style="font-size:14px;color:#8b949e;margin-bottom:24px;">' + dateStr + '</div>',

    '  <div style="background:#161b22;border:1px solid #21262d;border-radius:10px;padding:18px;margin-bottom:14px;">',
    '    <div style="font-size:11px;letter-spacing:2px;color:#e8375a;text-transform:uppercase;font-weight:700;margin-bottom:14px;">Boot Sequence — 8 min</div>',
    '    <div style="font-size:15px;color:#c9d1d9;line-height:2;">',
    '      &#9744; Feet on the floor inside the 07:15&ndash;07:20 alarm window<br>',
    '      &#9744; Calisthenics 07:20&ndash;07:35<br>',
    '      &#9744; Read the seven &ldquo;I am&rdquo; declarations<br>',
    '      &#9744; Name today\'s pillar &middot; state the tasks and where',
    '    </div>',
    '  </div>',

    '  <div style="background:#161b22;border:1px solid #21262d;border-radius:10px;padding:18px;margin-bottom:14px;">',
    '    <div style="font-size:11px;letter-spacing:2px;color:#e8375a;text-transform:uppercase;font-weight:700;margin-bottom:10px;">Your Mission Today</div>',
    '    <div style="font-size:15px;color:#8b949e;line-height:1.7;">Confirm today&rsquo;s task &mdash; commitment #1, chosen last night.<br>Hardest part first &mdash; no warmup.</div>',
    '  </div>',

    '  <div style="text-align:center;padding:16px 0 8px;">',
    '    <div style="font-size:18px;font-weight:900;color:#e8375a;letter-spacing:2px;">NEVER LOG A ZERO</div>',
    '  </div>',

    '  <a href="' + APP_URL + '" style="display:block;margin-top:20px;padding:16px;background:#e8375a;border-radius:10px;',
    '     color:white;font-size:16px;font-weight:700;text-align:center;text-decoration:none;letter-spacing:0.5px;">',
    '    Open The Operator &rarr;',
    '  </a>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to:       MY_EMAIL,
    subject:  subject,
    htmlBody: html
  });
}

// ── EVENING REMINDER — trigger at 21:00 ───────────────────
// Skips automatically if today's entry is already saved
function sendEveningReminder() {
  if (_alreadySavedToday()) return;

  var today = _todayStr();
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('lastEveningReminder') === today) return;
  props.setProperty('lastEveningReminder', today);

  var dateStr = _dateLabel(new Date());
  var subject = 'OPERATOR — Shutdown Protocol · ' + dateStr;

  var html = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:480px;background:#0d1117;color:#e6edf3;border-radius:12px;padding:28px 24px;">',
    '  <div style="font-size:11px;letter-spacing:3px;color:#e8375a;text-transform:uppercase;margin-bottom:6px;">Personal OS</div>',
    '  <div style="font-size:22px;font-weight:800;margin-bottom:4px;">THE OPERATOR</div>',
    '  <div style="font-size:14px;color:#8b949e;margin-bottom:24px;">' + dateStr + '</div>',

    '  <div style="background:#161b22;border:1px solid #21262d;border-radius:10px;padding:18px;margin-bottom:14px;">',
    '    <div style="font-size:11px;letter-spacing:2px;color:#e8375a;text-transform:uppercase;font-weight:700;margin-bottom:14px;">Shutdown Protocol — 8 min</div>',
    '    <div style="font-size:15px;color:#c9d1d9;line-height:2;">',
    '      &#9744; Mark every commitment D / M / X — no blank rows<br>',
    '      &#9744; Write the root cause for any miss (1 sentence)<br>',
    '      &#9744; Choose tomorrow\'s tasks — lay the materials out ready<br>',
    '      &#9744; Write where you stopped / what\'s next<br>',
    '      &#9744; Shutdown alarm &middot; bedtime set',
    '    </div>',
    '  </div>',

    '  <div style="background:#161b22;border:1px solid #21262d;border-radius:10px;padding:18px;margin-bottom:14px;">',
    '    <div style="font-size:11px;letter-spacing:2px;color:#e8375a;text-transform:uppercase;font-weight:700;margin-bottom:10px;">Close the Day</div>',
    '    <div style="font-size:15px;color:#8b949e;line-height:1.7;">No block ends without something saved.<br>Write your verdict, then Save to Log &amp; Reset.<br><em>I showed up. I stayed. I did the work.</em></div>',
    '  </div>',

    '  <a href="' + APP_URL + '" style="display:block;margin-top:20px;padding:16px;background:#e8375a;border-radius:10px;',
    '     color:white;font-size:16px;font-weight:700;text-align:center;text-decoration:none;letter-spacing:0.5px;">',
    '    Open The Operator &rarr;',
    '  </a>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to:       MY_EMAIL,
    subject:  subject,
    htmlBody: html
  });
}

// Serve the web app
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('The Operator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Get or create the Google Sheet
function getSheet() {
  var ss;
  var props = PropertiesService.getScriptProperties();
  var cachedId = props.getProperty('ssId');
  if (cachedId) {
    try { ss = SpreadsheetApp.openById(cachedId); } catch(e) { cachedId = null; }
  }
  if (!cachedId) {
    var files = DriveApp.getFilesByName(SS_NAME);
    var found = null;
    while (files.hasNext()) {
      var f = files.next();
      if (!f.isTrashed()) { found = f; break; }
    }
    if (found) {
      ss = SpreadsheetApp.open(found);
    } else {
      ss = SpreadsheetApp.create(SS_NAME);
    }
    props.setProperty('ssId', ss.getId());
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1,100); sheet.setColumnWidth(2,200);
    sheet.setColumnWidth(6,300); sheet.setColumnWidth(8,300); sheet.setColumnWidth(9,300);
    sheet.setColumnWidth(15,300);
    sheet.setColumnWidth(19,320); sheet.setColumnWidth(20,320); sheet.setColumnWidth(22,320);
  }
  _ensureColumns(sheet);
  return sheet;
}

// Widen an existing Log sheet to the current schema and (re)write the header
// row. Safe to run repeatedly; existing data rows are never touched.
function _ensureColumns(sheet) {
  var max = sheet.getMaxColumns();
  if (max < COLS) sheet.insertColumnsAfter(max, COLS - max);

  var hdr = sheet.getRange(1, 1, 1, COLS).getValues()[0];
  var stale = false;
  for (var i = 0; i < COLS; i++) {
    if (String(hdr[i] || '') !== HEADERS[i]) { stale = true; break; }
  }
  if (stale) {
    sheet.getRange(1, 1, 1, COLS).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF');
  }
}

// Run this directly from the Apps Script editor to test War Map writing
function testWarMapSync() {
  try {
    var testEntry = {
      date: _todayStr(),
      tomorrowPlan: '1. Claude setup\n2. TCM 10.3\n3. CR Act',
      commitments: []
    };
    var plan  = String(testEntry.tomorrowPlan || '');
    var lines = plan.split('\n')
      .map(function(l) { return l.replace(/^\s*\d+[\.\)\-]\s+/, '').trim(); })
      .filter(function(l) { return l.length > 0; });
    Logger.log('Parsed lines: ' + JSON.stringify(lines));

    var parts    = testEntry.date.split('-');
    var tomorrow = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1);
    var tomorrowStr = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    Logger.log('Tomorrow date: ' + tomorrowStr);

    var ss   = SpreadsheetApp.openById(WAR_MAP_ID);
    var cell = _warMapCell(tomorrowStr, ss);
    if (!cell) { Logger.log('ERROR: _warMapCell returned null - check sheet name (APR)'); return; }
    Logger.log('Target cell row=' + cell.row + ' col=' + cell.col + ' sheet=' + cell.sheet.getName());

    for (var i = 0; i < 3; i++) {
      var rng = cell.sheet.getRange(cell.row + 1 + i, cell.col);
      rng.setValue(lines[i] || '');
      rng.setFontSize(7).setWrap(true).setVerticalAlignment('top').setFontColor('#c9d1d9');
    }
    Logger.log('SUCCESS — wrote 3 lines to ' + cell.sheet.getName() + ' starting row ' + (cell.row + 1));
  } catch(e) {
    Logger.log('EXCEPTION: ' + e.message);
  }
}

// Locate the War Map sheet for a given month index (0-11), trying multiple
// naming variants so the calendar works whether the user labels tabs as
// 'MAY', 'May', 'may', or 'May 2026'. Returns null if no match.
function _findMonthSheet(ss, monthIndex) {
  var shortNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var fullNames  = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  var shortU = shortNames[monthIndex];
  var fullU  = fullNames[monthIndex];
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var name = all[i].getName().trim().toUpperCase();
    if (name === shortU || name === fullU) return all[i];
    if (name.indexOf(shortU) === 0 || name.indexOf(fullU) === 0) return all[i];
  }
  return null;
}

// Returns the War Map {sheet, row, col} for a given date, or null if not found
function _warMapCell(dateStr, ss) {
  ss = ss || SpreadsheetApp.openById(WAR_MAP_ID);
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  var sheet = _findMonthSheet(ss, d.getMonth());
  if (!sheet) return null;
  var dayOfMonth   = d.getDate();
  var firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  var firstDow     = firstOfMonth.getDay();
  var firstAdj     = (firstDow === 0) ? 6 : firstDow - 1;
  var cellIndex    = dayOfMonth - 1 + firstAdj;
  var weekRow      = Math.floor(cellIndex / 7);
  var colIdx       = cellIndex % 7;
  return { sheet: sheet, row: 4 + weekRow * 6, col: colIdx + 1 };
}

// Parse tomorrow's plan text and write the 3 items into tomorrow's War Map cells
function _syncCommitmentsToWarMap(entry) {
  try {
    var plan  = String(entry.tomorrowPlan || '');
    var lines = plan.split('\n')
      .map(function(l) { return l.replace(/^\s*\d+[\.\)\-]\s+/, '').trim(); })
      .filter(function(l) { return l.length > 0; });

    var parts    = entry.date.split('-');
    var tomorrow = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1);
    var tomorrowStr = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    var ss   = SpreadsheetApp.openById(WAR_MAP_ID);
    var cell = _warMapCell(tomorrowStr, ss);
    if (!cell) {
      Logger.log('War Map sync: no month sheet found for ' + tomorrowStr +
                 ' — check that a tab named like MAY / May / "May 2026" exists in the War Map spreadsheet.');
      return;
    }
    Logger.log('War Map sync: writing ' + lines.length + ' line(s) to "' +
               cell.sheet.getName() + '" for ' + tomorrowStr +
               ' (row ' + (cell.row + 1) + ', col ' + cell.col + ')');
    for (var i = 0; i < 3; i++) {
      var rng = cell.sheet.getRange(cell.row + 1 + i, cell.col);
      rng.setValue(lines[i] || '');
      rng.setFontSize(7).setWrap(true).setVerticalAlignment('top').setFontColor('#c9d1d9');
    }
  } catch(e) {
    Logger.log('War Map sync error: ' + e.message);
  }
}

// Clear the 3 War Map task cells for a given date
function _clearWarMapCells(dateStr) {
  try {
    var ss   = SpreadsheetApp.openById(WAR_MAP_ID);
    var cell = _warMapCell(dateStr, ss);
    if (!cell) return;
    for (var i = 0; i < 3; i++) {
      cell.sheet.getRange(cell.row + 1 + i, cell.col).setValue('');
    }
  } catch(e) {
    Logger.log('War Map clear error: ' + e.message);
  }
}

// A fresh row for today (COLS wide), used by the partial savers (morning boot,
// session, calisthenics) that create the day's row before it is closed out.
// Level stays blank so _alreadySavedToday() knows the day is still open.
function _blankRow(today) {
  return [
    today, _dateLabel(new Date()), '', 0, 0,
    '', '', '', '',
    '[]', '[]', '[]', '', 1, '{}',
    '', '', '', '', '', '', '[]', '', '', ''
  ];
}

// Build the full row (COLS wide) for a day entry.
function _entryRow(entry, morningChecksJson) {
  var s = entry.session || {};
  return [
    entry.date, entry.dateLabel, entry.level,
    entry.score, entry.total,
    entry.nonNeg, entry.missNote, entry.tomorrowPlan, entry.verdict,
    morningChecksJson,
    JSON.stringify(entry.eveningChecks),
    JSON.stringify(entry.commitments),
    entry.dailyNote || '',
    entry.rung != null ? entry.rung : (entry.phase != null ? entry.phase : 1),
    JSON.stringify(entry.review || {}),
    s.state  || '',
    s.block  || '',
    s.stayed || '',
    s.saved  || '',
    s.stoppedAt || '',
    s.track  || '',
    JSON.stringify(entry.backlog || []),
    entry.pillar || '',
    s.feeling || '',
    entry.calis || ''
  ];
}

// Save or update a day entry
function saveEntry(entryJson) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var entry = JSON.parse(entryJson);
    var sheet = getSheet();
    var data  = sheet.getDataRange().getValues();

    var i = _findRow(data, entry.date);
    if (i >= 0) {
        // Preserve morning checks if existing row has real data and incoming is all-false
        var morningToSave = JSON.stringify(entry.morningChecks);
        var existingMorning = data[i][9];
        if (existingMorning && String(existingMorning) !== '[]') {
          try {
            var existing = JSON.parse(existingMorning);
            var hasExisting = existing.some(function(v) { return v === true; });
            var hasNew = (entry.morningChecks || []).some(function(v) { return v === true; });
            if (hasExisting && !hasNew) {
              morningToSave = String(existingMorning);
            }
          } catch(e) {}
        }

        // Preserve a session already logged this morning if the evening save
        // carries nothing for it (the session is logged at 10:00, hours before).
        if (!String(entry.calis || '') && String(data[i][24] || '')) {
          entry.calis = String(data[i][24]);
        }
        if (!(entry.session && entry.session.state)) {
          var prior = {
            state: data[i][15], block: data[i][16], stayed: data[i][17],
            saved: data[i][18], stoppedAt: data[i][19], track: data[i][20],
            feeling: data[i][23]
          };
          if (String(prior.state || '')) entry.session = prior;
        }

        sheet.getRange(i+1, 1, 1, COLS).setValues([_entryRow(entry, morningToSave)]);
        _syncCommitmentsToWarMap(entry);
        return JSON.stringify({ success: true, action: 'updated' });
    }

    sheet.appendRow(_entryRow(entry, JSON.stringify(entry.morningChecks)));
    _syncCommitmentsToWarMap(entry);
    return JSON.stringify({ success: true, action: 'created' });

  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Return all entries newest first
function getLog() {
  try {
    var sheet = getSheet();
    var data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return JSON.stringify([]);

    var entries = [];
    for (var i = data.length - 1; i >= 1; i--) {
      try {
        var row = data[i];
        entries.push({
          date:          _toIso(row[0]),
          dateLabel:     String(row[1]),
          level:         String(row[2]),
          score:         Number(row[3]),
          total:         Number(row[4]),
          nonNeg:        String(row[5] || ''),
          missNote:      String(row[6] || ''),
          tomorrowPlan:  String(row[7] || ''),
          verdict:       String(row[8] || ''),
          morningChecks: JSON.parse(row[9]  || '[]'),
          eveningChecks: JSON.parse(row[10] || '[]'),
          commitments:   JSON.parse(row[11] || '[]'),
          dailyNote:     String(row[12] || ''),
          rung:          (row[13] !== '' && row[13] != null) ? Number(row[13]) : 1,
          phase:         (row[13] !== '' && row[13] != null) ? Number(row[13]) : 1,
          review:        (row[14] ? JSON.parse(row[14]) : {}),
          session: {
            state:     String(row[15] || ''),
            block:     String(row[16] || ''),
            stayed:    String(row[17] || ''),
            saved:     String(row[18] || ''),
            stoppedAt: String(row[19] || ''),
            track:     String(row[20] || '')
          },
          backlog:       (row[21] ? JSON.parse(row[21]) : []),
          pillar:        String(row[22] || ''),
          feeling:       String(row[23] || ''),
          calis:         String(row[24] || '')
        });
      } catch(rowErr) {
        Logger.log('getLog: skipped bad row ' + (i + 1) + ' — ' + rowErr.message);
      }
    }
    return JSON.stringify(entries);
  } catch(e) {
    return JSON.stringify([]);
  }
}

// Save morning checks independently (creates or updates today's row)
function saveMorningChecks(checksJson) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var payload = JSON.parse(checksJson);
    var checks = payload.checks || payload;
    var isLate = payload.late || false;
    var nonNeg = payload.nonNeg || '';
    if (isLate) {
      checks = checks.map(function() { return false; });
    }
    var sheet = getSheet();
    var today = _todayStr();
    var data  = sheet.getDataRange().getValues();
    var i = _findRow(data, today);
    if (i >= 0) {
      sheet.getRange(i+1, 10).setValue(JSON.stringify(checks));
      if (nonNeg) sheet.getRange(i+1, 6).setValue(nonNeg);
      if (payload.pillar) sheet.getRange(i+1, 23).setValue(payload.pillar);
      return JSON.stringify({ success: true, action: 'updated' });
    }
    var row = _blankRow(today);
    row[5] = nonNeg;                      // NonNeg
    row[9] = JSON.stringify(checks);      // MorningChecks
    row[22] = payload.pillar || '';       // Pillar named in the morning ritual
    sheet.appendRow(row);
    return JSON.stringify({ success: true, action: 'created' });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Save review data independently (creates or updates today's row)
function saveReview(reviewJson) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var review = JSON.parse(reviewJson);
    var sheet = getSheet();
    var today = _todayStr();
    var data  = sheet.getDataRange().getValues();
    var i = _findRow(data, today);
    if (i >= 0) {
      sheet.getRange(i+1, 15).setValue(JSON.stringify(review));
      return JSON.stringify({ success: true, action: 'updated' });
    }
    var row = _blankRow(today);
    row[14] = JSON.stringify(review);     // Review
    sheet.appendRow(row);
    return JSON.stringify({ success: true, action: 'created' });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Log the Daily Deep-Work Session on its own (Layer 3 — the block closes at
// ~10:00, hours before the day is closed out). Creates or updates today's row.
// Payload: { state, block, stayed, saved, stoppedAt, track }
function saveSession(sessionJson) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var s     = JSON.parse(sessionJson);
    var sheet = getSheet();
    var today = _todayStr();
    var data  = sheet.getDataRange().getValues();
    var vals  = [[
      s.state || '', s.block || '', s.stayed || '',
      s.saved || '', s.stoppedAt || '', s.track || ''
    ]];
    var i = _findRow(data, today);
    if (i >= 0) {
      sheet.getRange(i+1, 16, 1, 6).setValues(vals);
      sheet.getRange(i+1, 24).setValue(s.feeling || '');
      return JSON.stringify({ success: true, action: 'updated' });
    }
    var row = _blankRow(today);
    row[15] = vals[0][0]; row[16] = vals[0][1]; row[17] = vals[0][2];
    row[18] = vals[0][3]; row[19] = vals[0][4]; row[20] = vals[0][5];
    row[23] = s.feeling || '';
    sheet.appendRow(row);
    return JSON.stringify({ success: true, action: 'created' });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Persist the skills backlog (Layer 2 step 6 — the blocker you write down
// instead of switching resources). Creates or updates today's row.
function saveBacklog(backlogJson) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var list  = JSON.parse(backlogJson);
    var sheet = getSheet();
    var today = _todayStr();
    var data  = sheet.getDataRange().getValues();
    var i = _findRow(data, today);
    if (i >= 0) {
      sheet.getRange(i+1, 22).setValue(JSON.stringify(list));
      return JSON.stringify({ success: true, action: 'updated' });
    }
    var row = _blankRow(today);
    row[21] = JSON.stringify(list);
    sheet.appendRow(row);
    return JSON.stringify({ success: true, action: 'created' });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Log the morning calisthenics session on its own, at 07:20 — hours before the
// day is closed out. Stored as "session|version|level", e.g. "A|full|1".
// Session A is push, B is pull; the app alternates them so the pattern gets 48h.
function saveCalisthenics(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p     = JSON.parse(payload);
    var value = [p.session || '', p.version || '', p.level || 1].join('|');
    var sheet = getSheet();
    var today = _todayStr();
    var data  = sheet.getDataRange().getValues();
    var i = _findRow(data, today);
    if (i >= 0) {
      sheet.getRange(i + 1, 25).setValue(value);
      return JSON.stringify({ success: true, action: 'updated', value: value });
    }
    var row = _blankRow(today);
    row[24] = value;
    sheet.appendRow(row);
    return JSON.stringify({ success: true, action: 'created', value: value });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// Delete one entry by date
function deleteEntry(date) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet();
    var data  = sheet.getDataRange().getValues();
    var i = _findRow(data, date);
    if (i < 0) return JSON.stringify({ success: false });

    var parts = date.split('-');
    var tomorrow = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1);
    var tomorrowStr = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    _clearWarMapCells(tomorrowStr);

    sheet.deleteRow(i + 1);
    return JSON.stringify({ success: true });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}
