import {NextResponse, type NextRequest} from 'next/server'

export function middleware(request: NextRequest) {
  // Keep the established /driver URL while serving the isolated V3 app.
  if (request.nextUrl.pathname === '/driver' || request.nextUrl.pathname.startsWith('/driver/')) {
    const url = request.nextUrl.clone()
    url.pathname = request.nextUrl.pathname.replace(/^\/driver(?=\/|$)/, '/driver-v3')
    return NextResponse.rewrite(url)
  }
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2)$).*)'],
}
