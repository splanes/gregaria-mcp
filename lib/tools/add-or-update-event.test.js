import { test } from "node:test"
import assert from "node:assert/strict"
import { handleAddOrUpdateEvent } from "./add-or-update-event.js"

const BASE_ARGS = { name: "Test", workout_type: "Ride" }

test("strict=true aborts without writing when description has warnings", async () => {
  let calls = 0
  const addOrUpdateEvent = async () => {
    calls++
    return { id: 1 }
  }

  const result = await handleAddOrUpdateEvent(
    { ...BASE_ARGS, description: "TEST A\n- 12m 104%\nRecuperacion\n- 30m 45-55%", strict: true },
    "fake-api-key",
    { addOrUpdateEvent }
  )

  assert.equal(result.aborted, true)
  assert.equal(result.warnings.length, 1)
  assert.equal(calls, 0, "must not call the API when aborting")
})

test("strict=false writes anyway and surfaces the same warnings plus verification", async () => {
  const addOrUpdateEvent = async () => ({
    id: 1,
    workout_doc: {
      duration: 2520,
      steps: [
        { duration: 720, power: { units: "power_zone", value: 1 } },
        { duration: 1800, power: { units: "pct_of_ftp", start: 45, end: 55 } },
      ],
    },
  })

  const result = await handleAddOrUpdateEvent(
    { ...BASE_ARGS, description: "TEST A\n- 12m 104%\nRecuperacion\n- 30m 45-55%", strict: false },
    "fake-api-key",
    { addOrUpdateEvent }
  )

  assert.equal(result.aborted, undefined)
  assert.equal(result.warnings.length, 1)
  assert.equal(result.verification.status, "mismatch")
  assert.ok(result.verification.issues.some((i) => i.type === "lost-power-target"))
  assert.equal(result.event.id, 1)
})

test("strict defaults to not aborting when omitted, even with warnings", async () => {
  let calls = 0
  const addOrUpdateEvent = async () => {
    calls++
    return { id: 1 }
  }

  const result = await handleAddOrUpdateEvent(
    { ...BASE_ARGS, description: "un 3' bajo" },
    "fake-api-key",
    { addOrUpdateEvent }
  )

  assert.equal(calls, 1)
  assert.equal(result.aborted, undefined)
  assert.equal(result.warnings.length, 1)
})

test("clean description with strict=true writes normally (no warnings to abort on)", async () => {
  const addOrUpdateEvent = async () => ({ id: 1, workout_doc: { duration: 60, steps: [{ duration: 60, power: { units: "pct_of_ftp", start: 100, end: 100 } }] } })

  const result = await handleAddOrUpdateEvent(
    { ...BASE_ARGS, description: "- 1m 100%", strict: true },
    "fake-api-key",
    { addOrUpdateEvent }
  )

  assert.equal(result.aborted, undefined)
  assert.equal(result.warnings.length, 0)
  assert.equal(result.verification.status, "ok")
})

test("workout_doc given directly skips parsing/warnings entirely and is sent as its own field", async () => {
  let receivedEventData
  const addOrUpdateEvent = async (athleteId, apiKey, eventData) => {
    receivedEventData = eventData
    return { id: 1, workout_doc: eventData.workout_doc }
  }

  const doc = { steps: [{ duration: 60 }] }
  const result = await handleAddOrUpdateEvent(
    { ...BASE_ARGS, workout_doc: doc, strict: true },
    "fake-api-key",
    { addOrUpdateEvent }
  )

  assert.equal(receivedEventData.workout_doc, doc)
  assert.equal(receivedEventData.description, null)
  assert.equal(result.warnings.length, 0)
  assert.equal(result.verification.status, "ok")
  assert.match(result.verification.message, /text parser wasn't used/)
})

test("no description and no workout_doc (e.g. a plain note) verifies as ok with nothing to check", async () => {
  const addOrUpdateEvent = async () => ({ id: 1 })

  const result = await handleAddOrUpdateEvent(BASE_ARGS, "fake-api-key", { addOrUpdateEvent })

  assert.equal(result.warnings.length, 0)
  assert.equal(result.verification.status, "ok")
})
