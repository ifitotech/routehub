import {NextResponse, type NextRequest} from 'next/server'

export function middleware(request: NextRequest) {
  // Official Driver URL is /driver. Serve the V3 app under that path.
  // Physical code remains in app/driver-v3; V2 files stay as non-routed fallback code only.
  if (request.nextUrl.pathname === '/driver' || request.nextUrl.pathname.startsWith('/driver/')) {
    // Do not rewrite /driver-v3 itself
    if (!request.nextUrl.pathname.startsWith('/driver-v3')) {
      const url = request.nextUrl.clone()
      url.pathname = request.nextUrl.pathname.replace(/^\/driver(?=\/|$)/, '/driver-v3')
      const response = NextResponse.rewrite(url)
      response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()')
      return response
    }
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
