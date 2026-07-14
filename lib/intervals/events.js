// Calendar events: listing, create/edit, single and range delete.
import { get, post, put, del } from "./client.js"

export function getEvents(athleteId, apiKey, { start, end } = {}) {
  return get(`/athlete/${athleteId}/events`, apiKey, { params: { oldest: start, newest: end } })
}

export function getEventById(athleteId, eventId, apiKey) {
  return get(`/athlete/${athleteId}/events/${eventId}`, apiKey)
}

// If eventId is given, updates (PUT); otherwise creates (POST).
export function addOrUpdateEvent(athleteId, apiKey, eventData, eventId) {
  const base = `/athlete/${athleteId}/events`
  const path = eventId ? `${base}/${eventId}` : base
  return eventId ? put(path, apiKey, eventData) : post(path, apiKey, eventData)
}

export function deleteEvent(athleteId, eventId, apiKey) {
  return del(`/athlete/${athleteId}/events/${eventId}`, apiKey)
}

// Fetch-then-delete-loop: there's no bulk-delete endpoint, so we fetch the
// list for the range and delete event by event (same as the Python version).
export async function deleteEventsByDateRange(athleteId, apiKey, { start, end }) {
  const events = await get(`/athlete/${athleteId}/events`, apiKey, {
    params: { oldest: start, newest: end },
  })
  const list = Array.isArray(events) ? events : []
  const failed = []
  for (const event of list) {
    try {
      await del(`/athlete/${athleteId}/events/${event.id}`, apiKey)
    } catch {
      failed.push(event.id)
    }
  }
  return { deletedCount: list.length - failed.length, failed }
}
