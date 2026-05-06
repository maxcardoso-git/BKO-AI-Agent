import { verifySession } from './dal'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

export async function fetchAPI(path: string, options?: RequestInit) {
  const url = `${BACKEND_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  return res
}

export async function fetchAuthAPI(path: string, options?: RequestInit) {
  const session = await verifySession()
  const url = `${BACKEND_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...options?.headers,
    },
  })
  return res
}
