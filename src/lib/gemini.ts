import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createServerSupabaseClient } from './supabaseServer';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

const searchDoctorsTool: any = {
  functionDeclarations: [
    {
      name: 'search_doctors_by_specialization',
      description: 'Search the database of registered hospital doctors by their medical specialization.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          specialization: {
            type: SchemaType.STRING,
            description: 'The medical specialization to search for, e.g. Cardiology, Dermatology, Pediatrics, General Medicine, Orthopedics, Neurology, Psychiatry, Gynecology.',
          },
        },
        required: ['specialization'],
      },
    },
  ],
};

export async function generateAIResponse(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[]
) {
  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [searchDoctorsTool],
      });

      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role,
          parts: h.parts
        })),
      });

      let result = await chat.sendMessage(message);
      let responseText = result.response.text();
      let functionCalls = result.response.functionCalls();
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

          // Send the function response back to Gemini
          const functionResponsePart = {
            functionResponse: {
              name: 'search_doctors_by_specialization',
              response: { doctors: doctorsResult }
            }
          };

          const followUpResult = await chat.sendMessage([functionResponsePart]);
          responseText = followUpResult.response.text();
        }
      }

      return {
        text: responseText,
        doctors: doctorsResult, // Send structured list of doctors back to the frontend to render nice cards
      };
    } catch (error) {
      console.warn(`Gemini Model ${modelName} failed, trying next... Error:`, error);
      lastError = error;
    }
  }

  // If all models failed:
  console.error('All Gemini models failed. Last error:', lastError);
  return {
    text: 'Sorry, the AI health assistant is temporarily unavailable. If you are experiencing a medical emergency, please call your local emergency services (e.g. 911 or 108) immediately.',
    doctors: []
  };
}
