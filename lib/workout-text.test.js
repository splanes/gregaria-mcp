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
})

test("nested repetition headers warn", () => {
  const { warnings } = parseWorkoutText("Outer 2x\n- Inner 2x\n- 1m 100%")
  assert.ok(warnings.some((w) => w.type === "nested-repetition"))
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
