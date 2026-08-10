import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { generateAIResponse } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please login.' }, { status: 401 });
    }

    // Verify user is a patient
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Access denied. Patients only.' }, { status: 403 });
    }

    // 2. Parse request body
    const body = await req.json();
    const { message, sessionId: incomingSessionId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    let sessionId = incomingSessionId;

    // 3. Create session if it doesn't exist
    if (!sessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({ patient_id: user.id })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return NextResponse.json({ error: 'Failed to create chat session.' }, { status: 500 });
      }
      sessionId = newSession.id;
    } else {
      // Verify session belongs to patient
      const { data: session, error: verifyError } = await supabase
        .from('chat_sessions')
        .select('patient_id')
        .eq('id', sessionId)
        .single();

      if (verifyError || !session || session.patient_id !== user.id) {
        return NextResponse.json({ error: 'Invalid chat session.' }, { status: 400 });
      }
    }

    // 4. Save patient message and fetch history concurrently
    const savePatientMsgPromise = supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'PATIENT',
        message: message.trim()
      });

    const fetchHistoryPromise = supabase
      .from('chat_messages')
      .select('sender, message, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10); // Reduced from 30 to speed up DB and AI processing

    const [saveResult, historyResult] = await Promise.all([savePatientMsgPromise, fetchHistoryPromise]);

    if (saveResult.error) {
      console.error('Save patient message error:', saveResult.error);
      return NextResponse.json({ error: 'Failed to save message.' }, { status: 500 });
    }

    let chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    
    if (!historyResult.error && historyResult.data) {
      // If this was an existing session, the history fetch will not include the message we just saved
      // since they ran concurrently (or it might race). 
      // We just pass the fetched history up to the AI, Gemini's SDK will append the current message.
      const pastMessages = historyResult.data;
      chatHistory = pastMessages.map(msg => ({
        role: msg.sender === 'PATIENT' ? 'user' : 'model',
        parts: [{ text: msg.message }]
      }));
    }

    // 6. Generate response from Gemini (with tool calling)
    const aiResult = await generateAIResponse(message, chatHistory);

    if (aiResult.isRateLimit) {
      return NextResponse.json({ 
        error: aiResult.text,
        isRateLimit: true
      }, { status: 429 });
    }

    // 7. Save AI message in DB
    const { error: saveAiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'AI',
        message: aiResult.text
      });

    if (saveAiMsgError) {
      console.error('Save AI message error:', saveAiMsgError);
    }

    // 8. Return response
    return NextResponse.json({
      text: aiResult.text,
      doctors: aiResult.doctors,
      sessionId
    });

  } catch (error) {
    console.error('Route API error in chat route:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// Fetch all chat sessions for the authenticated patient
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('id, created_at, updated_at')
      .eq('patient_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions.' }, { status: 500 });
    }

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Route GET error in chat route:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
