import axios from 'axios'

let accessGateGraceUntil = 0
let accessGatePromise: Promise<boolean> | null = null

export async function ensureAccessGatePassed() {
  if (accessGateGraceUntil > Date.now())
    return true
  if (accessGatePromise)
    return accessGatePromise

  accessGatePromise = axios.get('/api/access-gate/status', {
    timeout: 6000,
    withCredentials: true,
  }).then((res) => {
    const passed = !!(res.data && res.data.passed)
    accessGateGraceUntil = passed ? Date.now() + 5000 : 0
    return passed
  }).catch(() => {
    accessGateGraceUntil = 0
    return false
  }).finally(() => {
    accessGatePromise = null
  })

  return accessGatePromise
}

export function markAccessGatePassed() {
  accessGateGraceUntil = Date.now() + 5000
}

export function clearAccessGatePassed() {
  accessGateGraceUntil = 0
}
