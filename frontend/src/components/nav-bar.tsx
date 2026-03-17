import { cookies } from 'next/headers'
import { decrypt } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/actions'

export async function NavBar() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  const session = await decrypt(sessionCookie)

  if (!session) return null

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <span className="font-semibold text-lg">BKO Agent</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.name}</span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
