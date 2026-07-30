import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'
export function middleware(request:NextRequest){const path=request.nextUrl.pathname;if(['/login','/auth/callback'].includes(path)||path.startsWith('/_next'))return NextResponse.next();const hasSession=request.cookies.getAll().some(c=>c.name.startsWith('sb-')&&c.name.includes('auth-token'));if(!hasSession){const url=request.nextUrl.clone();url.pathname='/login';return NextResponse.redirect(url)}return NextResponse.next()}
export const config={matcher:['/','/admin/:path*','/requests/:path*','/routes/:path*','/settings/:path*']}
