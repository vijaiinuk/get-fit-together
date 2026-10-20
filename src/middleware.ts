import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Keeps the Supabase session fresh and sends signed-out visitors to the login page.
export async function middleware(request: NextRequest) {
  // If the callback URL isn't in Supabase's Redirect URLs list, Supabase sends people to the
  // Site URL instead (e.g. "/?code=..."). Forward those to the callback so sign-in still completes.
  const { pathname, searchParams } = request.nextUrl;
  if (!pathname.startsWith('/auth') && (searchParams.has('code') || searchParams.has('token_hash'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refreshes the session cookie if needed and checks it. Local check with asymmetric JWT keys.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims.sub ?? null;

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith('/login') || path.startsWith('/auth');
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon|icon|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
