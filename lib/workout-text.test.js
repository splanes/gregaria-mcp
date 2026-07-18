import { test } from "node:test"
import assert from "node:assert/strict"
import { parseWorkoutText, verifyWorkoutDoc } from "./workout-text.js"

// --- Repro 1: missing blank line between blocks drops a power target ---

test("missing blank line before a block header warns", () => {
  const { warnings, steps } = parseWorkoutText("TEST A\n- 12m 104%\nRecuperacion\n- 30m 45-55%")
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].type, "missing-blank-line-before-block")
  assert.equal(warnings[0].line, 3)
  assert.equal(steps.length, 2)
  assert.equal(steps[0].durationSec, 720)
  assert.equal(steps[0].hasPercent, true)
})

test("blank line between blocks parses clean, no warning", () => {
  const { warnings } = parseWorkoutText("TEST A\n\n- 12m 104%\n\nRecuperacion\n\n- 30m 45-55%")
  assert.equal(warnings.length, 0)
})

test("verification flags the step that lost its power target", () => {
  const expected = parseWorkoutText("TEST A\n- 12m 104%\nRecuperacion\n- 30m 45-55%")
  // What Intervals actually returns for this broken input: step 1 keeps its
  // duration but falls back to power_zone 1, silently dropping the 104% target.
  const brokenWorkoutDoc = {
    duration: 2520,
    steps: [
      { duration: 720, power: { units: "power_zone", value: 1 } },
      { duration: 1800, power: { units: "pct_of_ftp", start: 45, end: 55 } },
    ],
  }

  const result = verifyWorkoutDoc(expected, brokenWorkoutDoc)
  assert.equal(result.status, "mismatch")
  const lost = result.issues.find((i) => i.type === "lost-power-target")
  assert.ok(lost, "expected a lost-power-target issue")
  assert.equal(lost.step, 1)
  assert.equal(lost.expected, "- 12m 104%")
})

test("verification is ok when the correctly-parsed workout_doc comes back", () => {
  const expected = parseWorkoutText("TEST A\n\n- 12m 104%\n\nRecuperacion\n\n- 30m 45-55%")
  const goodWorkoutDoc = {
    duration: 2520,
    steps: [
      { duration: 720, power: { units: "pct_of_ftp", start: 104, end: 104 } },
      { duration: 1800, power: { units: "pct_of_ftp", start: 45, end: 55 } },
    ],
  }
  assert.equal(verifyWorkoutDoc(expected, goodWorkoutDoc).status, "ok")
})

// --- Repro 2: prose with duration-like tokens becomes phantom steps ---

test("prose containing a duration-like token warns", () => {
  assert.equal(parseWorkoutText("un 3' bajo").warnings[0].type, "prose-duration-pattern")
  assert.equal(parseWorkoutText("cafeina 200mg 1h antes").warnings[0].type, "prose-duration-pattern")
})

test("plain block-header prose without duration tokens doesn't warn", () => {
  assert.equal(parseWorkoutText("TEST A").warnings.length, 0)
  assert.equal(parseWorkoutText("Recuperacion").warnings.length, 0)
})

test("verification flags phantom steps and inflated total duration from prose", () => {
  const expected = parseWorkoutText("Warmup\n\n- 10m 60%\n\ncafeina 200mg 1h antes")
  assert.equal(expected.steps.length, 1)

  // Intervals turns "1h antes" into a phantom 3600s step alongside the real one.
  const brokenWorkoutDoc = {
    duration: 4200,
    steps: [
      { duration: 600, power: { units: "pct_of_ftp", start: 60, end: 60 } },
      { duration: 3600, power: { units: "power_zone", value: 1 } },
    ],
  }

  const result = verifyWorkoutDoc(expected, brokenWorkoutDoc)
  assert.equal(result.status, "mismatch")
  assert.ok(result.issues.some((i) => i.type === "step-count-mismatch"))
  assert.ok(result.issues.some((i) => i.type === "total-duration-mismatch"))
})

// --- Repro 3: a repetition header written with a leading "-" collapses to 1 rep ---

test("repetition header with a leading dash warns and is unrolled locally", () => {
  const { warnings, steps } = parseWorkoutText("Main Set\n\n- 8x\n- 1m 100%")
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].type, "rep-header-leading-dash")
  assert.equal(warnings[0].line, 3)
  // Locally we still unroll it correctly (8 copies) so verification below can
  // show exactly how far off Intervals' actual 1-rep collapse is.
  assert.equal(steps.length, 8)
})

test("repetition header without a leading dash doesn't warn", () => {
  assert.equal(parseWorkoutText("Main Set 8x\n- 1m 100%").warnings.length, 0)
})

test("verification flags the collapsed repeat count", () => {
  const expected = parseWorkoutText("Main Set\n\n- 8x\n- 1m 100%")
  // Intervals treats "- 8x" as a literal step, so only 1 repetition of the
  // following step survives instead of 8.
  const brokenWorkoutDoc = {
    duration: 60,
    steps: [{ duration: 60, power: { units: "pct_of_ftp", start: 100, end: 100 } }],
  }

  const result = verifyWorkoutDoc(expected, brokenWorkoutDoc)
  assert.equal(result.status, "mismatch")
  const countIssue = result.issues.find((i) => i.type === "step-count-mismatch")
  assert.ok(countIssue)
  assert.equal(countIssue.expected, 8)
  assert.equal(countIssue.actual, 1)
  // Counts don't line up, so no per-step diff should be attempted (see the
  // cascade regression test below for why).
  assert.equal(result.issues.some((i) => "step" in i), false)
})

test("nested repetition headers warn", () => {
  const { warnings } = parseWorkoutText("Outer 2x\n- Inner 2x\n- 1m 100%")
  assert.ok(warnings.some((w) => w.type === "nested-repetition"))
})

// --- Regression: positional diffs cascade into false positives on count mismatch ---
// Real production case: an 8x rep collapsed (19 expected steps vs 5 stored),
// and the old index-by-index compare additionally reported a bogus
// "step 5 (- 30s 118%): expected 30s, stored 420s" — step 5 in the stored
// doc was actually the cooldown, not the 5th interval. One bug, reported as
// three. Per-step diffs are now suppressed whenever counts disagree.

test("step-count mismatch does not cascade into bogus per-step diffs", () => {
  const expected = parseWorkoutText(
    "Main Set 4x\n- 4m 90%\n- 30s 118%\n\nCooldown\n- 10m 50%"
  )
  assert.equal(expected.steps.length, 9) // 4x(4m+30s) + 1 cooldown step

  // Simulates the collapse: only 2 of the 8 interval steps survived, plus
  // the cooldown — and by sheer coincidence the cooldown lands at an index
  // that would misalign with one of the expected interval steps if diffed
  // positionally.
  const brokenWorkoutDoc = {
    duration: 9999,
    steps: [
      { duration: 240, power: { units: "pct_of_ftp", start: 90, end: 90 } },
      { duration: 30, power: { units: "pct_of_ftp", start: 118, end: 118 } },
      { duration: 600, power: { units: "pct_of_ftp", start: 50, end: 50 } }, // cooldown, landed at index 2
    ],
  }

  const result = verifyWorkoutDoc(expected, brokenWorkoutDoc)
  assert.equal(result.status, "mismatch")
  assert.equal(result.issues.length, 2) // step-count-mismatch + total-duration-mismatch only
  assert.deepEqual(
    result.issues.map((i) => i.type),
    ["step-count-mismatch", "total-duration-mismatch"]
  )
})

// --- Lost power target, isolated from the (unreliable) blank-line heuristic ---
// Counts match here (1 expected, 1 stored) so this exercises verifyWorkoutDoc's
// core detection on its own, independent of which pre-flight warning (if any) fired.

test("lost-power-target fires on its own when counts match, regardless of pre-flight warnings", () => {
  const expected = parseWorkoutText("- 12m 104%")
  assert.equal(expected.warnings.length, 0) // no pre-flight warning here at all

  const brokenWorkoutDoc = {
    duration: 720,
    steps: [{ duration: 720, power: { units: "power_zone", value: 1 } }],
  }

  const result = verifyWorkoutDoc(expected, brokenWorkoutDoc)
  assert.equal(result.status, "mismatch")
  assert.equal(result.issues.length, 1)
  assert.equal(result.issues[0].type, "lost-power-target")
  assert.equal(result.issues[0].step, 1)
})

// --- Regression fixture: event 123652836 (real production failure) ---
// The only *confirmed* real-world repro of "step loses its target, duration
// stays correct". Reconstructed from the reported line sequence — pending a
// byte-exact pull via get_event_by_id(123652836) if it ever needs updating.
//
// Follow-up testing showed the missing-blank-line heuristic is NOT the root
// cause: a separate doc with zero blank lines anywhere parsed fine. This
// fixture happens to also lack a blank line before its second block, which
// is why parseWorkoutText below still flags it — but treat that warning as
// coincidental, not diagnostic. The real root cause is still unidentified.
// What's pinned here is the observed *symptom*: the final step ("- 12m
// 104%") silently loses its target while keeping the correct duration.

const EVENT_123652836_DESCRIPTION =
  "Apertura C\n- 1m 100%\n- 5m 50%\nTEST A. Maximo sostenido\n- 12m 104%"

test("fixture: event 123652836 — parseWorkoutText's current (heuristic) read", () => {
  const parsed = parseWorkoutText(EVENT_123652836_DESCRIPTION)
  assert.equal(parsed.steps.length, 3)
  assert.equal(parsed.steps[2].raw, "- 12m 104%")
  assert.equal(parsed.steps[2].hasPercent, true)
  // Coincidentally trips the (unreliable) missing-blank-line heuristic — see
  // the comment above. Not asserted as the explanation, just the current output.
  assert.ok(parsed.warnings.some((w) => w.type === "missing-blank-line-before-block"))
})

test("fixture: event 123652836 — verifyWorkoutDoc catches the confirmed real symptom", () => {
  const expected = parseWorkoutText(EVENT_123652836_DESCRIPTION)
  // Observed in production: steps 1-2 come back intact, step 3 (12m 104%)
  // keeps its 720s duration but loses the target to the power_zone-1 fallback.
  const observedBrokenWorkoutDoc = {
    duration: 1080,
    steps: [
      { duration: 60, power: { units: "pct_of_ftp", start: 100, end: 100 } },
      { duration: 300, power: { units: "pct_of_ftp", start: 50, end: 50 } },
      { duration: 720, power: { units: "power_zone", value: 1 } },
    ],
  }

  const result = verifyWorkoutDoc(expected, observedBrokenWorkoutDoc)
  assert.equal(result.status, "mismatch")
  assert.equal(result.issues.length, 1)
  assert.equal(result.issues[0].type, "lost-power-target")
  assert.equal(result.issues[0].step, 3)
})

// --- verification edge cases ---

test("verifyWorkoutDoc reports ok with no expected steps and no workout_doc", () => {
  const expected = parseWorkoutText(undefined)
  assert.deepEqual(verifyWorkoutDoc(expected, undefined), {
    status: "ok",
    issues: [],
    message: "No steps expected from the description; nothing to verify.",
  })
})

test("verifyWorkoutDoc reports unverifiable when steps expected but response shape is unrecognized", () => {
  const expected = parseWorkoutText("- 10m 60%")
  const result = verifyWorkoutDoc(expected, { some: "unexpected shape" })
  assert.equal(result.status, "unverifiable")
})
