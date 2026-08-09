import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh user session if it exists
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();

  // Define route protections
  const isDoctorRoute = url.pathname === '/doctor' || url.pathname.startsWith('/doctor/');
  const isDoctorAuthRoute = url.pathname.startsWith('/doctor/login') || url.pathname.startsWith('/doctor/register');
  const isPatientAuthRoute = url.pathname.startsWith('/login') || url.pathname.startsWith('/register');
  
  // Patient private routes
  const isPatientPrivateRoute = 
    url.pathname.startsWith('/dashboard') || 
    url.pathname.startsWith('/profile') || 
    url.pathname.startsWith('/appointments') || 
    url.pathname.startsWith('/assistant');

  if (user) {
    // If logged in, fetch their role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role;

    if (role === 'DOCTOR') {
      // Doctor logged in: should not access patient private pages or patient auth
      if (isPatientPrivateRoute || isPatientAuthRoute || url.pathname === '/') {
        url.pathname = '/doctor/dashboard';
        return NextResponse.redirect(url);
      }
      // If trying to access doctor auth, redirect to doctor dashboard
      if (isDoctorAuthRoute) {
        url.pathname = '/doctor/dashboard';
        return NextResponse.redirect(url);
      }
    } else {
      // Patient/Admin logged in: should not access doctor private pages
      if (isDoctorRoute && !isDoctorAuthRoute) {
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      // If trying to access patient auth, redirect to dashboard
      if (isPatientAuthRoute) {
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    }
  } else {
    // Not logged in
    if (isPatientPrivateRoute) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (isDoctorRoute && !isDoctorAuthRoute) {
      url.pathname = '/doctor/login';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
