// Eventos del calendario: lectura, alta/edición, borrado individual y por rango.
import { get, post, put, del } from "./client.js"

export function getEvents(athleteId, apiKey, { start, end } = {}) {
  return get(`/athlete/${athleteId}/events`, apiKey, { params: { oldest: start, newest: end } })
}

export function getEventById(athleteId, eventId, apiKey) {
  return get(`/athlete/${athleteId}/events/${eventId}`, apiKey)
}

// Si eventId viene, actualiza (PUT); si no, crea (POST).
export function addOrUpdateEvent(athleteId, apiKey, eventData, eventId) {
  const base = `/athlete/${athleteId}/events`
  const path = eventId ? `${base}/${eventId}` : base
  return eventId ? put(path, apiKey, eventData) : post(path, apiKey, eventData)
}

export function deleteEvent(athleteId, eventId, apiKey) {
  return del(`/athlete/${athleteId}/events/${eventId}`, apiKey)
}

// Fetch-then-delete-loop: no hay endpoint de borrado masivo, así que se trae
// la lista del rango y se borra evento por evento (igual que el Python).
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
