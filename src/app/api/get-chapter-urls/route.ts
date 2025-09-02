import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// The base URL for the actual images
// add other adress in the future
const IMAGE_BASE_URL = 'https://meo.comick.pictures';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapterUrl = searchParams.get('url');

  if (!URL || !chapterUrl) {
    return NextResponse.json({ error: 'Chapter URL parameter is required.' }, { status: 400 });
  }

  try {
    // --- 1. Extract the unique "hid" from the chapter URL ---
    // Example URL: https://comick.io/comic/slug/hid-chapter-num
    const urlParts = chapterUrl.split('/');
    const hid = urlParts.find(part => part.includes('-chapter-')); // Heuristic to find the ID
    
    if (!hid) {
      throw new Error("Could not extract chapter ID (hid) from URL.");
    }

    // --- 2. Call the real Comick API ---
    const apiUrl = `https://api.comick.fun/chapter/${hid}`;
    const response = await axios.get(apiUrl);

    // --- 3. Parse the response and build the image URL list ---
    const chapterData = response.data;
    // The image data is in `chapter.md_images`
    const images = chapterData?.chapter?.md_images;

    if (!images || !Array.isArray(images)) {
        throw new Error("Could not find image list in API response.");
    }

    const imageUrls = images.map(img => {
        // The filename is stored in the 'b2key' property
        return `${IMAGE_BASE_URL}${img.b2key}`;
    });

    return NextResponse.json({ urls: imageUrls });

  } catch (error: any) {
    console.error("Failed to get chapter URLs:", error.message);
    return NextResponse.json({ error: 'Failed to fetch or parse chapter data.' }, { status: 500 });
  }
}