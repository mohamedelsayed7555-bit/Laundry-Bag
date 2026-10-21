import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Legal pages are linked from the app stores and the customer app, so they must open without signing in.
const PUBLIC_PAGES = ['/terms', '/privacy', '/delete-account']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getUser() verifies the token with the Auth server; getSession() trusts the cookie as-is.
  // This gate only decides redirects (RLS and requireAdmin do the real enforcement), but a
  // forged cookie shouldn't be able to render the shell either.
  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'
  if (PUBLIC_PAGES.includes(request.nextUrl.pathname)) {
    return response
  }

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  // Static files in /public were being redirected to /login like any other path, so the
  // login page could never load its own logo or background. Anything with a file
  // extension is an asset, not a route, and the session check does not apply to it.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.[a-zA-Z0-9]+$).*)'],
}
