# Tests

No build step and no test framework — these run against the real `Index.html`,
pulling the actual functions out of the file by brace-matching rather than
duplicating them. That means a test cannot silently drift from the code it
covers: rename a function and the harness fails to find it.

```bash
node tests/verify.js       # structural: parses, ids resolve, handlers defined
node tests/flow.test.js    # behavioural: the daily flow logic
```

**`verify.js`** guards the things a single-file frontend makes easy to break.
Every `getElementById` in the script must resolve to markup that exists, every
inline `onclick` must name a function that is defined, divs and CSS braces must
balance, and the accessibility floor (no informational text below 13px, no
low-contrast greys, pinch-zoom not disabled) must hold.

**`flow.test.js`** stubs `localStorage` and a minimal DOM, freezes the clock,
and exercises the real logic: the derived shutdown checks, the seeding of
tomorrow's first task from where today stopped, and the single definition of
"an active day" shared by the streak, the scoreboard and the failure protocol.
