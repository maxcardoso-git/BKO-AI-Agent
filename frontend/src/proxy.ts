import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'
import { cookies } from 'next/headers'

export async function proxy(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  const session = await decrypt(sessionCookie)
  const { pathname } = request.nextUrl

  const isAuthenticated = !!session?.userId

  // Redirect authenticated user away from /login
  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/tickets', request.url))
  }

  // Protect /tickets routes
  if (!isAuthenticated && pathname.startsWith('/tickets')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tickets/:path*', '/login'],
}
