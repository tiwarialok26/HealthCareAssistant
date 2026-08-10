'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Mic, 
  MicOff, 
  Send, 
  Plus, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  CheckCircle2, 
  UserCheck, 
  Star, 
  MapPin, 
  DollarSign, 
  Bot, 
  User, 
  History,
  MessageSquareHeart,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id?: string;
  sender: 'PATIENT' | 'AI';
  message: string;
  created_at?: string;
  doctors?: any[]; // Dynamic doctor cards
}

interface ChatSession {
  id: string;
  created_at: string;
}

export default function AIAssistantPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const speechUtteranceRef = useRef<any>(null);

  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserProfile(user);

      // Fetch sessions
      const response = await fetch('/api/chat');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
        if (data.length > 0) {
          // Load most recent session
          handleSelectSession(data[0].id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    initPage();
    initSpeechRecognition();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize Speech Recognition
  const initSpeechRecognition = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US'; // Can dynamically adapt or default to bilingual

    rec.onstart = () => {
      setIsListening(true);
      setStatusText('Listening...');
      setMicError(null);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setMicError('Microphone permission is required for voice chat.');
      } else {
        setMicError('Speech recognition error: ' + event.error);
      }
      setStatusText('');
    };

    rec.onend = () => {
      setIsListening(false);
      setStatusText('');
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInputText(transcript);
        handleSendMessage(transcript);
      }
    };

    recognitionRef.current = rec;
  };

  const handleSelectSession = async (sessionId: string) => {
    setLoading(true);
    setCurrentSessionId(sessionId);
    try {
      const response = await fetch(`/api/chat/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInputText('');
  };

  const isProcessingRef = useRef(false);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || sending || isProcessingRef.current) return;

    // Strict lock to prevent double-firing before React state 'sending' updates
    isProcessingRef.current = true;
    setSending(true);

    // Stop speaking if currently speaking
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    const patientMsg: Message = { sender: 'PATIENT', message: text };
    setMessages(prev => [...prev, patientMsg]);
    setInputText('');
    setStatusText('Processing...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: currentSessionId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages(prev => [...prev, { 
          sender: 'AI', 
          message: data.error || (response.status === 429 ? 'Please wait a moment before sending another message.' : 'Failed to get response.') 
        }]);
        setSending(false);
        isProcessingRef.current = false;
        setStatusText('');
        return;
      }

      // Update current session id locally without a network request
      if (!currentSessionId) {
        setCurrentSessionId(data.sessionId);
        setSessions(prev => [{ id: data.sessionId, created_at: new Date().toISOString() }, ...prev]);
      }

      // Add AI response
      const aiMsg: Message = {
        sender: 'AI',
        message: data.text,
        doctors: data.doctors
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Speak response if not muted
      if (!isMuted) {
        speakResponse(data.text);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'AI', message: 'Unable to communicate with AI Assistant.' }]);
    } finally {
      setSending(false);
      isProcessingRef.current = false;
      if (!isSpeaking) {
        setStatusText('');
      }
    }
  };

  // Text to Speech
  const speakResponse = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop any current speech

    // Clean text from markdown bold asterisks or bullet points for nicer speech
    const cleanText = text.replace(/[*#_\-\`]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Automatically match language for voice synthesizer
    // Check for Hindi/Hinglish keywords to choose appropriate voice
    const isHindi = /[\u0900-\u097F]/.test(text) || /\b(hai|hu|ko|se|ka|ki|ke|mere|mujhe|dard|bukhar|pet|sir)\b/i.test(text);
    
    if (isHindi) {
      utterance.lang = 'hi-IN'; // Hindi synthesizer
    } else {
      utterance.lang = 'en-US';
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setStatusText('Assistant speaking...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatusText('');
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setStatusText('');
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      // Stop speech synthesis if speaking
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      
      // Ask for permission and start
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setStatusText('');
    }
  };

  return (
    <div className="flex-grow flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-4rem)]">
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow overflow-hidden">
        
        {/* Sidebar: Historical Conversations */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-4 flex flex-col overflow-hidden shadow-sm h-full max-h-[300px] lg:max-h-full">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-850">
            <span className="font-bold text-gray-800 dark:text-gray-250 flex items-center gap-1.5 text-sm">
              <History className="h-4.5 w-4.5 text-blue-500" /> Chat History
            </span>
            <button
              onClick={handleCreateNewSession}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-900/10 transition"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pt-3">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                No previous conversations.
              </div>
            ) : (
              sessions.map(sess => {
                const isActive = currentSessionId === sess.id;
                return (
                  <button
                    key={sess.id}
                    onClick={() => handleSelectSession(sess.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold truncate transition ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-gray-650 dark:text-gray-350 hover:bg-gray-50 dark:hover:bg-gray-850'
                    }`}
                  >
                    Consultation - {new Date(sess.created_at).toLocaleDateString()}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Feed & Input */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl flex flex-col overflow-hidden shadow-md h-full">
          
          {/* Header Title Info */}
          <div className="px-6 py-4 border-b border-gray-105 dark:border-gray-850 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">AI Health Assistant</h3>
                <p className="text-[10px] text-gray-450 dark:text-gray-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-ping" /> Online • Hindi, English & Hinglish
                </p>
              </div>
            </div>

            {/* Mute Synthesizer Toggle */}
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-xl transition ${
                isMuted 
                  ? 'bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400' 
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
              }`}
              title={isMuted ? 'Unmute Speech Output' : 'Mute Speech Output'}
            >
              {isMuted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
            </button>
          </div>

          {/* Safety Disclaimer Banner */}
          <div className="bg-blue-50 text-blue-800 dark:bg-blue-950/25 dark:text-blue-400 px-6 py-2.5 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <span>AI-generated information is for general informational purposes and is not a substitute for professional medical diagnosis.</span>
          </div>

          {/* Message List Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <MessageSquareHeart className="h-16 w-16 text-blue-200 dark:text-blue-800 mb-3 animate-pulse" />
                <h4 className="font-bold text-gray-800 dark:text-gray-250">How are you feeling today?</h4>
                <p className="text-xs text-gray-450 dark:text-gray-400 max-w-sm mt-1 leading-relaxed">
                  Describe your symptoms (e.g., "mujhe 2 din se fever hai") or ask for general health advice. Speak in English, Hindi, or Hinglish.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isAI = msg.sender === 'AI';
                return (
                  <div key={idx} className={`flex gap-3.5 ${isAI ? 'justify-start' : 'justify-end'}`}>
                    
                    {/* Icon */}
                    {isAI && (
                      <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Bot className="h-4.5 w-4.5" />
                      </div>
                    )}

                    {/* Balloon */}
                    <div className="max-w-[85%] flex flex-col gap-2">
                      <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                        isAI 
                          ? 'bg-gray-100 dark:bg-gray-850 text-gray-800 dark:text-gray-250' 
                          : 'bg-blue-600 text-white'
                      }`}>
                        {msg.message}
                      </div>

                      {/* Doctor Cards Carousel (if recommended by AI) */}
                      {isAI && msg.doctors && msg.doctors.length > 0 && (
                        <div className="pt-2 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                          {msg.doctors.map(doc => (
                            <div
                              key={doc.id}
                              className="bg-white dark:bg-gray-850 border border-gray-150 dark:border-gray-750 rounded-2xl p-4 shadow-sm w-60 shrink-0 flex flex-col justify-between"
                            >
                              <div className="flex gap-3 mb-3">
                                {doc.profile_photo ? (
                                  <img
                                    src={doc.profile_photo}
                                    alt={doc.full_name}
                                    className="h-10 w-10 rounded-xl object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                                    {doc.full_name?.replace('Dr. ', '').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="font-bold text-gray-850 dark:text-gray-200 text-xs block truncate">
                                    {doc.full_name}
                                  </span>
                                  <span className="text-[10px] text-blue-600 dark:text-blue-450 block truncate">
                                    {doc.specialization}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 space-y-1 mb-4 flex-grow">
                                <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {doc.hospital_name}</p>
                                <p className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-500" /> Fees: Rs.{doc.consultation_fee}</p>
                              </div>

                              <Link
                                href={`/doctors/${doc.id}`}
                                className="block text-center w-full py-1.5 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                              >
                                Book Appointment
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {!isAI && (
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-inner">
                        <User className="h-4 w-4" />
                      </div>
                    )}

                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex gap-3 justify-start items-center">
                <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div className="flex gap-1 items-center bg-gray-100 dark:bg-gray-850 px-4 py-3 rounded-2xl">
                  <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Status Display Area */}
          {(statusText || micError) && (
            <div className="px-6 py-1.5 bg-gray-55/30 border-t border-gray-100 dark:border-gray-850 flex items-center justify-between text-xs">
              <span className={`font-semibold flex items-center gap-1.5 ${isListening ? 'text-red-500' : 'text-gray-505 dark:text-gray-400'}`}>
                {isListening && <span className="h-2 w-2 bg-red-500 rounded-full animate-ping" />}
                {statusText}
              </span>
              {micError && (
                <span className="text-red-500 font-medium">{micError}</span>
              )}
            </div>
          )}

          {/* Form and Input Area */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-3">
            
            {/* Mic voice button */}
            <button
              onClick={handleToggleVoice}
              className={`p-3 rounded-2xl transition duration-200 focus:outline-none shadow-md ${
                isListening 
                  ? 'bg-red-500 text-white hover:bg-red-650 animate-pulse' 
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/25 dark:hover:bg-blue-900/40 dark:text-blue-400'
              }`}
              title={isListening ? 'Stop Listening' : 'Speak to AI'}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            {/* Input Text Box */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={sending}
              placeholder={isListening ? "Listening..." : "Type your symptoms in English, Hindi, or Hinglish..."}
              className="flex-grow px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Send Text Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={sending || !inputText.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-55 disabled:cursor-not-allowed text-white rounded-2xl transition shadow-md focus:outline-none"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
