import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Helper to get authenticated user role from server side
export async function getAuthUserRole() {
  try {
    const supabaseServer = await createServerSupabaseClient();
    const { data: { user }, error } = await supabaseServer.auth.getUser();
    
    if (error || !user) return null;

    // Fetch profile role
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return null;

    return {
      user,
      role: profile.role as 'PATIENT' | 'DOCTOR' | 'ADMIN'
    };
  } catch (err) {
    console.error('Error getting auth user role:', err);
    return null;
  }
}
