// Local (best-effort) re-implementation of Intervals.icu's workout-text
// parser, used to validate a `description` before we send it and to verify
// the `workout_doc` Intervals sends back after it runs its own (silently
// lossy) parser server-side. See lib/tools/events.js for the three known
// failure modes this guards against.
//
// Intervals' actual workout_doc JSON shape isn't in its OpenAPI spec (the
// field is typed as an untyped object there). The step shape assumed below
// — `{ duration, power: { units, value|start|end } }` — is inferred from a
// confirmed bug report, not from official docs, so verifyWorkoutDoc() is
// deliberately defensive: if the response doesn't look like what we expect,
// it reports "unverifiable" rather than a false "ok".

const STEP_DURATION_RE = /^-\s*(\d+(?:\.\d+)?)\s*(min|h|m|s)\b/i
const UNIT_SECONDS = { h: 3600, min: 60, m: 60, s: 1 }

// A rep header is a line that's just a count ending in "x" ("8x", "Main Set 8x").
const REP_HEADER_RE = /(?:^|\s)\d+\s*[xX]\s*$/
const REP_COUNT_RE = /(\d+)\s*[xX]\s*$/

// Prose line containing a duration-like token Intervals might parse as a phantom step.
const DURATION_PATTERN = /\d+\s*(?:min|h|m|s|')(?=\s|$|[^a-z])/i

function isRepHeaderText(text) {
  return REP_HEADER_RE.test(text)
}

function repCount(text) {
  const m = REP_COUNT_RE.exec(text)
  return m ? Number(m[1]) : 1
}

function parseStepLine(line, lineNumber) {
  const match = STEP_DURATION_RE.exec(line)
  const durationSec = match ? Math.round(parseFloat(match[1]) * UNIT_SECONDS[match[2].toLowerCase()]) : null
  const rest = match ? line.slice(match[0].length) : line
  return { raw: line, line: lineNumber, durationSec, hasPercent: /%/.test(rest) }
}

// Parses Intervals workout-text client-side, flattening repeat blocks (best
// effort — nesting is inferred from adjacency, not real indentation) and
// flagging the three known lossy-parse patterns.
export function parseWorkoutText(description) {
  const lines = (description ?? "").split("\n")
  const warnings = []
  const steps = []
  let repStack = []
  let sawStepsInCurrentBlock = false

  const currentMultiplier = () => repStack.reduce((a, b) => a * b, 1) || 1

  const pushRepHeader = (count, lineNo, raw) => {
    if (repStack.length > 0) {
      warnings.push({
        type: "nested-repetition",
        line: lineNo,
        message: `Line ${lineNo}: "${raw}" is a repetition header nested inside another repeat block — Intervals doesn't support nested repeats. It was unrolled locally for verification, but rewrite it as flat repeated steps.`,
      })
    }
    repStack.push(count)
    sawStepsInCurrentBlock = false
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()
    const lineNo = idx + 1

    if (line === "") {
      repStack = []
      sawStepsInCurrentBlock = false
      return
    }

    if (line.startsWith("-")) {
      const withoutDash = line.slice(1).trim()
      if (isRepHeaderText(withoutDash)) {
        warnings.push({
          type: "rep-header-leading-dash",
          line: lineNo,
          message: `Line ${lineNo}: repetition header "${line}" starts with "-" — Intervals treats it as a literal step (1 rep) instead of repeating the block that follows. Remove the leading "-" (write "${withoutDash}").`,
        })
        pushRepHeader(repCount(withoutDash), lineNo, line)
        return
      }

      const step = parseStepLine(line, lineNo)
      const multiplier = currentMultiplier()
      for (let i = 0; i < multiplier; i++) steps.push(step)
      sawStepsInCurrentBlock = true
      return
    }

    if (isRepHeaderText(line)) {
      pushRepHeader(repCount(line), lineNo, line)
      return
    }

    if (DURATION_PATTERN.test(line)) {
      warnings.push({
        type: "prose-duration-pattern",
        line: lineNo,
        message: `Line ${lineNo}: "${line}" reads like prose but contains a duration-like token; Intervals may parse it as a phantom step.`,
      })
    } else if (sawStepsInCurrentBlock) {
      warnings.push({
        type: "missing-blank-line-before-block",
        line: lineNo,
        message: `Line ${lineNo}: block header "${line}" isn't preceded by a blank line separating it from the previous block — the previous block's last step may lose its target.`,
      })
    }
    repStack = []
    sawStepsInCurrentBlock = false
  })

  const totalDurationSec = steps.reduce((sum, s) => sum + (s.durationSec || 0), 0)
  return { steps, warnings, totalDurationSec }
}

function extractActualSteps(workoutDoc) {
  const steps = workoutDoc?.steps ?? workoutDoc?.workout?.steps
  return Array.isArray(steps) ? steps : null
}

function stepDurationSec(step) {
  return step?.duration ?? step?.durationSec ?? step?.duration_secs ?? null
}

// Intervals' silent fallback for a target it failed to parse is power_zone
// value 1 with no explicit range — that's what we're specifically looking for.
function lostPowerTarget(step) {
  const p = step?.power
  if (!p) return true
  return p.units === "power_zone" && p.value === 1 && p.start == null && p.end == null
}

// Compares the locally expected steps (from parseWorkoutText) against the
// workout_doc Intervals actually stored, surfacing count/duration/target
// discrepancies. Always returns a `status` so callers can trust the summary
// without re-reading the full workout_doc.
export function verifyWorkoutDoc(expected, workoutDoc) {
  const actualSteps = extractActualSteps(workoutDoc)

  if (actualSteps === null) {
    const hasExpectedSteps = expected.steps.length > 0
    return {
      status: hasExpectedSteps ? "unverifiable" : "ok",
      issues: [],
      message: hasExpectedSteps
        ? "Couldn't verify: the response's workout_doc has no recognizable steps array."
        : "No steps expected from the description; nothing to verify.",
    }
  }

  const issues = []

  if (actualSteps.length !== expected.steps.length) {
    issues.push({
      type: "step-count-mismatch",
      message: `Expected ${expected.steps.length} step(s), Intervals stored ${actualSteps.length}.`,
      expected: expected.steps.length,
      actual: actualSteps.length,
    })
  }

  const n = Math.min(actualSteps.length, expected.steps.length)
  for (let i = 0; i < n; i++) {
    const exp = expected.steps[i]
    const act = actualSteps[i]
    const actDuration = stepDurationSec(act)
    if (exp.durationSec != null && actDuration != null && actDuration !== exp.durationSec) {
      issues.push({
        type: "step-duration-mismatch",
        step: i + 1,
        message: `Step ${i + 1} ("${exp.raw}"): expected ${exp.durationSec}s, Intervals stored ${actDuration}s.`,
        expected: exp.durationSec,
        actual: actDuration,
      })
    }
    if (exp.hasPercent && lostPowerTarget(act)) {
      issues.push({
        type: "lost-power-target",
        step: i + 1,
        message: `Step ${i + 1} ("${exp.raw}") had a "%" power target in the source text but came back as power_zone 1 (Intervals' silent-parse fallback) — the target was lost.`,
        expected: exp.raw,
        actual: act?.power ?? null,
      })
    }
  }

  const actualTotal = workoutDoc?.duration ?? actualSteps.reduce((sum, s) => sum + (stepDurationSec(s) || 0), 0)
  if (expected.totalDurationSec && actualTotal != null && actualTotal !== expected.totalDurationSec) {
    issues.push({
      type: "total-duration-mismatch",
      message: `Expected total duration ${expected.totalDurationSec}s, workout_doc totals ${actualTotal}s.`,
      expected: expected.totalDurationSec,
      actual: actualTotal,
    })
  }

  return {
    status: issues.length ? "mismatch" : "ok",
    issues,
    message: issues.length
      ? `${issues.length} discrepanc${issues.length === 1 ? "y" : "ies"} between the requested workout and what Intervals stored.`
      : "workout_doc matches the requested steps.",
  }
}
