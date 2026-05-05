import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Protected routes - explicit targeting
    '/dashboard/:path*',
    '/api/admin/:path*',
    '/api/v1/:path*',
    // Catch-all for auth refresh on other routes (excludes static assets)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
