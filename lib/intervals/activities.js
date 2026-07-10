// Actividades: lectura, detalle, intervals, streams (con preview truncado),
// mensajes, y las mutaciones (update/delete de actividad e intervals).
import { subDays, format } from "date-fns"
import { get, post, put, del } from "./client.js"

function dateRange(days) {
  const newest = format(new Date(), "yyyy-MM-dd")
  const oldest = format(subDays(new Date(), days), "yyyy-MM-dd")
  return { oldest, newest }
}

// Actividades recientes (carga).
export function getActivities(athleteId, apiKey, { start, end, days = 14, limit } = {}) {
  const r = start && end ? { oldest: start, newest: end } : dateRange(days)
  return get(`/athlete/${athleteId}/activities`, apiKey, { params: { ...r, limit } })
}

export function getActivityDetails(activityId, apiKey) {
  return get(`/activity/${activityId}`, apiKey)
}

export function getActivityIntervals(activityId, apiKey) {
  return get(`/activity/${activityId}/intervals`, apiKey)
}

const STREAM_PREVIEW_THRESHOLD = 10
const DEFAULT_STREAM_TYPES = "time,watts,heartrate,cadence,altitude,distance,velocity_smooth"

// Trunca arrays de miles de puntos a primeros 5 + últimos 5 para no reventar
// el tamaño de la respuesta (única salvaguarda que portamos del Python).
function truncateStream(stream) {
  const { data, ...rest } = stream
  if (!Array.isArray(data) || data.length <= STREAM_PREVIEW_THRESHOLD) return stream
  return {
    ...rest,
    dataPointCount: data.length,
    dataPreview: { first5: data.slice(0, 5), last5: data.slice(-5) },
  }
}

export async function getActivityStreams(activityId, apiKey, { types } = {}) {
  const params = { types: types || DEFAULT_STREAM_TYPES }
  const streams = await get(`/activity/${activityId}/streams`, apiKey, { params })
  if (!Array.isArray(streams)) return streams
  return streams.map(truncateStream)
}

export function getActivityMessages(activityId, apiKey, { sinceId } = {}) {
  return get(`/activity/${activityId}/messages`, apiKey, { params: sinceId ? { sinceId } : {} })
}

export function postActivityMessage(activityId, apiKey, text) {
  return post(`/activity/${activityId}/messages`, apiKey, { content: text })
}

export function updateActivity(activityId, apiKey, fields) {
  return put(`/activity/${activityId}`, apiKey, fields)
}

export function deleteActivity(activityId, apiKey) {
  return del(`/activity/${activityId}`, apiKey)
}

export function updateActivityInterval(activityId, intervalId, apiKey, { startIndex, endIndex }) {
  return put(`/activity/${activityId}/intervals/${intervalId}`, apiKey, {
    start_index: startIndex,
    end_index: endIndex,
  })
}
