// Core logic for the add_or_update_event tool, split out from events.js so
// it's testable without a network call: pass a stub `addOrUpdateEvent` to
// avoid hitting Intervals.icu.
import { format } from "date-fns"
import { addOrUpdateEvent as addOrUpdateEventApi } from "../intervals/index.js"
import { resolveAthleteId } from "./shared.js"
import { parseWorkoutText, verifyWorkoutDoc } from "../workout-text.js"

const dateStr = () => format(new Date(), "yyyy-MM-dd")

// Breaking change from the pre-validation feature: this used to resolve to
// the bare Intervals event object. It now always returns
// { event, warnings, verification } — callers reading the tool result must
// unwrap `.event` to get what used to be the whole response.
export async function handleAddOrUpdateEvent(args, apiKey, { addOrUpdateEvent = addOrUpdateEventApi } = {}) {
  // Only the text-description path is parsed server-side, so only it needs guarding.
  const parsed = args.workout_doc === undefined ? parseWorkoutText(args.description) : null

  if (parsed && args.strict && parsed.warnings.length > 0) {
    return {
      aborted: true,
      warnings: parsed.warnings,
      message: `Aborted without writing: ${parsed.warnings.length} warning(s) found in 'description' and strict=true. Fix the text, switch to 'workout_doc', or resend with strict=false to write anyway.`,
    }
  }

  const startDate = args.start_date || dateStr()
  const eventData = {
    start_date_local: `${startDate}T00:00:00`,
    category: "WORKOUT",
    name: args.name,
    description: args.description ?? null,
    type: args.workout_type,
    moving_time: args.moving_time,
    distance: args.distance,
  }
  if (args.workout_doc !== undefined) eventData.workout_doc = args.workout_doc

  const event = await addOrUpdateEvent(resolveAthleteId(args), apiKey, eventData, args.event_id)

  const verification = parsed
    ? verifyWorkoutDoc(parsed, event?.workout_doc)
    : { status: "ok", issues: [], message: "workout_doc sent directly; Intervals' text parser wasn't used, so there's nothing to verify." }

  return { event, warnings: parsed?.warnings ?? [], verification }
}
