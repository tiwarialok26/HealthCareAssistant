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
  // Use currently available model names (updated Aug 2026)
  const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    // Try each model up to 2 times (with a delay on rate-limit)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
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
            
            // Execute the database search
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
        };
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        console.warn(`Gemini Model ${modelName} (attempt ${attempt + 1}) failed:`, errorMessage);

        // If rate-limited (429), wait and retry once
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          if (attempt === 0) {
            console.log(`Rate limited on ${modelName}, waiting 35 seconds before retry...`);
            await delay(35000);
            continue; // retry same model
          }
        }

        // If model is not found/deprecated (404), skip to next model immediately
        if (errorMessage.includes('404') || errorMessage.includes('NOT_FOUND')) {
          break; // try next model
        }

        break; // other errors, try next model
      }
    }
  }

  // If all models failed, return a descriptive error
  const errorMsg = lastError?.message || '';
  const isRateLimit = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota');

  console.error('All Gemini models failed. Last error:', lastError);
  
  return {
    text: isRateLimit
      ? 'The AI assistant has reached its usage limit temporarily. Please wait a few minutes and try again. If you are experiencing a medical emergency, please call emergency services (911 or 108) immediately.'
      : 'Sorry, the AI health assistant is temporarily unavailable. If you are experiencing a medical emergency, please call your local emergency services (e.g. 911 or 108) immediately.',
    doctors: []
  };
}

