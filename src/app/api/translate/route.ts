import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { texts } = await request.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'A non-empty array of texts is required.' }, { status: 400 });
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `You are an expert manga translator. Translate the following Japanese text blocks into natural-sounding English. Maintain the original order and provide the translation in a clean JSON array of strings, with no other text or markdown.

    Input (JSON Array):
    ${JSON.stringify(texts)}

    Output (JSON Array of translated strings):
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Clean the response to ensure it's valid JSON
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const translatedTexts = JSON.parse(cleanedText);

    return NextResponse.json({ translations: translatedTexts });

  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json({ error: 'Failed to translate text.' }, { status: 500 });
  }
}