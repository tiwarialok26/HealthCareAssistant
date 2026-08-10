import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...rest] = trimmed.split('=');
    process.env[key] = rest.join('=');
  }
});

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key (first 10 chars):', apiKey?.substring(0, 10) + '...');
console.log('API Key length:', apiKey?.length);

const ai = new GoogleGenAI({ apiKey });

const models = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite'];

for (const modelName of models) {
  console.log(`\n--- Testing model: ${modelName} ---`);
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Say hello in one sentence.',
    });
    console.log('✅ SUCCESS:', response.text?.substring(0, 100));
    break;
  } catch (error) {
    console.log('❌ FAILED:', error.message || error);
  }
}
