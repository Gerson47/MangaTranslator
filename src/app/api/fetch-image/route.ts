import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required.' }, { status: 400 });
  }

  try {
    // --- START OF CHANGES ---

    // Define browser-like headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': new URL(url).origin + '/', // Set the referer to the base domain of the image URL
    };

    // Make the request with the new headers
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: headers, // Pass the headers here
    });
    
    // --- END OF CHANGES ---

    const contentType = response.headers['content-type'];
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const dataUri = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ image: dataUri });
  } catch (error: any) {
    // Log more detailed error information
    if (axios.isAxiosError(error)) {
      console.error(`Failed to fetch image: AxiosError - Status ${error.response?.status}`, error.message);
      return NextResponse.json(
        { error: `Failed to fetch image from the URL. The server responded with status: ${error.response?.status}` },
        { status: 500 }
      );
    }
    console.error('Failed to fetch image:', error);
    return NextResponse.json({ error: 'An unknown error occurred while fetching the image.' }, { status: 500 });
  }
}