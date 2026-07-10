import { registerAthleteTools } from "./athlete.js"
import { registerWellnessTools } from "./wellness.js"
import { registerActivityTools } from "./activities.js"
import { registerEventTools } from "./events.js"
import { registerAnalysisTools } from "./analysis.js"

export function registerTools(server) {
  registerAthleteTools(server)
  registerWellnessTools(server)
  registerActivityTools(server)
  registerEventTools(server)
  registerAnalysisTools(server)
}
