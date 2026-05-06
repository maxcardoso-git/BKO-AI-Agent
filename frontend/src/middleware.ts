import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value
  const session = await decrypt(sessionCookie)
  const { pathname } = request.nextUrl

  const isAuthenticated = !!session?.userId

  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/tickets', request.url))
  }

  if (!isAuthenticated && pathname.startsWith('/tickets')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tickets/:path*', '/login'],
}
