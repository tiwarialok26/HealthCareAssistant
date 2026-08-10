import { GoogleGenAI, Type } from '@google/genai';
import { createServerSupabaseClient } from './supabaseServer';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Define system instructions for safety, language, and booking
const SYSTEM_INSTRUCTION = `
You are the Hospital's AI Healthcare Assistant. You are a compassionate, professional medical assistant.
Your goals:
1. Provide general, safe healthcare information. You are NOT a replacement for a doctor. NEVER confidently diagnose a patient. Include a gentle disclaimer if they ask for diagnostic opinions.
2. SCREEN FOR EMERGENCIES: If the patient describes severe symptoms like:
   - Severe chest pain or pressure
   - Severe difficulty breathing or shortness of breath
   - Unconsciousness or fainting
   - Severe bleeding
   - Stroke symptoms (slurred speech, weakness on one side of face/body)
   - Severe allergic reaction (anaphylaxis)
   - Suicidal thoughts or self-harm
   URGENTLY tell them to call emergency services (like 911, 108 or go to the nearest ER) immediately. Do NOT offer diagnostic guidance for these.
3. LANGUAGE INTEGRATION: Automatically match the user's language.
   - If they speak English, respond in English.
   - If they speak Hindi, respond in Hindi.
   - If they speak Hinglish (Hindi written in English alphabet, e.g., "mujhe kal se fever hai"), respond naturally in Hinglish.
4. DOCTOR RECOMMENDATION: If the user describes symptoms that require medical attention, or asks to see a doctor, identify the most relevant medical specialization and use the tool "search_doctors_by_specialization" to look up real available doctors in our hospital.
   - Specializations available in our hospital include: Cardiology, Dermatology, Pediatrics, General Medicine, Orthopedics, Neurology, Psychiatry, Gynecology, Ophthalmology, ENT.
   - Present the search results to the patient. Tell them they can book an appointment with them directly in the chat or on the Find Doctors page.
`;

// Tool definition for doctor search
const searchDoctorsTool = {
  functionDeclarations: [
    {
      name: 'search_doctors_by_specialization',
      description: 'Search the database of registered hospital doctors by their medical specialization.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          specialization: {
            type: Type.STRING,
            description: 'The medical specialization to search for, e.g. Cardiology, Dermatology, Pediatrics, General Medicine, Orthopedics, Neurology, Psychiatry, Gynecology.',
          },
        },
        required: ['specialization'],
      },
    },
  ],
};

// Helper to delay execution
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateAIResponse(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[]
) {
  // Use a single supported free-tier model
  const modelName = 'gemini-2.0-flash';
  let lastError: any = null;
  const maxRetries = 3;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Gemini API Request: model=${modelName}, attempt=${attempt + 1}, reason='User chat message'`);

      // Create a chat session with history
      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [searchDoctorsTool],
        },
        history: history.map(h => ({
          role: h.role,
          parts: h.parts,
        })),
      });

      // Send the user's message
      let result = await chat.sendMessage({ message });
      let responseText = result.text || '';
      let functionCalls = result.functionCalls;
      let doctorsResult: any[] = [];

      // Check if the model wants to call a function/tool
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'search_doctors_by_specialization') {
          const args = call.args as { specialization: string };
          
          const supabase = await createServerSupabaseClient();
          const { data: doctors, error } = await supabase
            .from('doctor_profiles')
            .select('id, full_name, specialization, qualification, consultation_fee, hospital_name, verification_status, profile_photo, experience_years')
            .ilike('specialization', `%${args.specialization}%`);

          if (error) {
            console.error('Error fetching doctors for AI:', error);
          } else {
            doctorsResult = doctors || [];
          }

          const followUpTimestamp = new Date().toISOString();
          console.log(`[${followUpTimestamp}] Gemini API Request: model=${modelName}, attempt=${attempt + 1}, reason='Function response callback'`);

          // Send the function response back to the model
          const followUpResult = await chat.sendMessage({
            message: [{
              functionResponse: {
                name: 'search_doctors_by_specialization',
                response: { doctors: doctorsResult }
              }
            }]
          });

          responseText = followUpResult.text || '';
        }
      }

      return {
        text: responseText,
        doctors: doctorsResult,
        isRateLimit: false,
        rawError: null
      };
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota');
      
      console.log(`\n=== GEMINI RESPONSE ===`);
      console.log(`status: ${error?.status || error?.code || 'UNKNOWN'}`);
      console.log(`error: ${errorMessage}`);
      
      // Attempt to extract detailed Google RPC quota information if available
      let quotaInfo = 'No specific quota details found in error object';
      let retryDelay = 'None provided';
      
      if (error?.details && Array.isArray(error.details)) {
        console.log(`details: ${JSON.stringify(error.details, null, 2)}`);
        
        const quotaFailure = error.details.find((d: any) => d['@type']?.includes('QuotaFailure'));
        if (quotaFailure && quotaFailure.violations) {
           quotaInfo = JSON.stringify(quotaFailure.violations);
        }
        
        const retryInfo = error.details.find((d: any) => d['@type']?.includes('RetryInfo'));
        if (retryInfo) {
           retryDelay = retryInfo.retryDelay;
        }
      }

      console.log(`quota: ${quotaInfo}`);
      console.log(`retryDelay: ${retryDelay}`);
      console.log(`=======================\n`);

      if (isRateLimit && attempt < maxRetries) {
        // Exponential backoff: 1s -> 2s -> 4s
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited (429). Retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }
      
      break; // Stop retrying on non-429 errors or if max retries reached
    }
  }

  // If we reach here, all retries failed
  const errorMsg = lastError?.message || '';
  const isRateLimit = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota');
  
  console.error(`\n[${new Date().toISOString()}] Gemini API final failure. Rate limited: ${isRateLimit}`);
  
  // Return the EXACT error message to the frontend for debugging purposes
  return {
    text: `DEBUG API ERROR: ${errorMsg}`,
    doctors: [],
    isRateLimit: true, // Force true to trigger the 429 handler in route.ts, or we can let route.ts pass it through
    rawError: errorMsg
  };
}

