import { NextRequest, NextResponse } from 'next/server';
import { 
  GoogleGenerativeAI, 
  HarmBlockThreshold,
  HarmCategory, 
} from '@google/generative-ai';

// Initialize the Google AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { texts } = await request.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'A non-empty array of texts is required.' }, { status: 400 });
    }
    
    const model = genAI.getGenerativeModel(
      { 
        model: "gemini-2.5-flash-lite", 

      }
    );

    const contents = [
    {
      role: 'system',
      parts: [
        {
          text: `You are an expert manga translator. Translate the following Japanese (or any language besides english) text blocks into natural-sounding English. Maintain the original order and provide the translation in a clean JSON array of strings, with no other text or markdown.

                  Input (JSON Array):
                  ${JSON.stringify(texts)}

                  Output (JSON Array of translated strings):
                  `,
        },
      ],
    },
  ];

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,  // Block none
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,  // Block none
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,  // Block none
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,  // Block none
      },
    ];

    

    const prompt = `You are an expert manga translator. Translate the following Japanese text blocks into natural-sounding English. Maintain the original order and provide the translation in a clean JSON array of strings, with no other text or markdown.

    Input (JSON Array):
    ${JSON.stringify(texts)}

    Output (JSON Array of translated strings):
    `;
    
    const result = await model.generateContent({
      contents,
      safetySettings,
    });
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