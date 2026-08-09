import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const resolvedParams = await params;
    const sessionId = resolvedParams.sessionId;

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 2. Verify session belongs to patient
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('patient_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session || session.patient_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized or session not found.' }, { status: 403 });
    }

    // 3. Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, sender, message, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching chat messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages.' }, { status: 500 });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error in session messages route:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
