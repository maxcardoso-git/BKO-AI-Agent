'use server'

import { redirect } from 'next/navigation'
import { createSession } from '@/lib/session'
import { fetchAPI } from '@/lib/api'

export interface LoginState {
  error?: string
}

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email e senha são obrigatórios.' }
  }

  let accessToken: string
  let user: { id: string; email: string; name: string; role: string }

  try {
    const res = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { error: data?.message ?? 'Email ou senha inválidos.' }
    }

    const data = await res.json()
    accessToken = data.access_token
    user = data.user
  } catch {
    return { error: 'Erro ao conectar com o servidor. Tente novamente.' }
  }

  await createSession(accessToken, user)
  redirect('/tickets')
}
