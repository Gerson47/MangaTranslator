"use client";

import { useState, useEffect, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import TranslationOverlay from './components/TranslationOverlay';

// Define types for our state - no changes here
type PageStatus = 'pending' | 'loading' | 'done' | 'error';
interface PageData {
  status: PageStatus;
  originalImage?: string;
  translatedBlocks?: any[];
  originalWidth?: number;
  originalHeight?: number;
}

/**
 * NEW HELPER FUNCTION
 * Gets the dimensions of a Base64 encoded image.
 * @param base64String The Base64 data URI of the image.
 * @returns A promise that resolves with the image's width and height.
 */
const getImageDimensions = (base64String: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = (err) => {
      console.error("Failed to load image for dimension check");
      reject(err);
    };
    img.src = base64String;
  });
};


export default function HomePage() {
  const [urlInput, setUrlInput] = useState('');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(5);

  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pagesData, setPagesData] = useState<PageData[]>([]);

  // UPDATED PIPELINE FUNCTION
  const fullTranslationPipeline = async (url: string) => {
    // 1. Fetch image via our proxy
    const imageRes = await fetch(`/api/fetch-image?url=${encodeURIComponent(url)}`);
    if (!imageRes.ok) throw new Error('Failed to fetch image via proxy.');
    const { image: imageBase64 } = await imageRes.json();
    
    // 2. Get image dimensions using our new helper function
    const { width: originalWidth, height: originalHeight } = await getImageDimensions(imageBase64);

    // 3. Run OCR
    const { data } = await Tesseract.recognize(imageBase64, 'jpn');
    
    // The 'data' object from Tesseract.js IS of type Page and contains 'blocks'.
    // Use 'blocks' for text regions.
    const textBlocks = (data.blocks ?? []).map(b => ({
      text: b.text.replace(/\s/g, ''),
      bbox: b.bbox
    }));
    // 4. Translate text via our proxy
    const textsToTranslate = textBlocks.map(block => block.text).filter(Boolean);
    if (textsToTranslate.length === 0) {
      return { originalImage: imageBase64, translatedBlocks: [], originalWidth, originalHeight };
    }
    
    const translateRes = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: textsToTranslate }),
    });
    if (!translateRes.ok) throw new Error('Failed to get translation.');
    const { translations } = await translateRes.json();
    
    // 5. Combine data
    const finalTranslatedBlocks = textBlocks.map((block, index) => ({
      ...block,
      translation: translations[index] || '',
    }));
    
    return { originalImage: imageBase64, translatedBlocks: finalTranslatedBlocks, originalWidth, originalHeight };
  };

  const updatePageData = (index: number, data: Partial<PageData>) => {
    setPagesData(currentData => {
      const newData = [...currentData];
      newData[index] = { ...newData[index], ...data };
      return newData;
    });
  };


 useEffect(() => {
    if (pageUrls.length === 0) return;

    // Define the processing function inside the effect.
    // This ensures it always has the latest state and props.
    const processPage = async (index: number) => {
      // Guard clauses: check if index is valid and if page is already being processed or is done.
      if (index < 0 || index >= pageUrls.length || pagesData[index]?.status !== 'pending') {
        return;
      }
      
      // Use a functional update for setting state to avoid race conditions.
      setPagesData(current => {
        const next = [...current];
        next[index] = { ...next[index], status: 'loading' };
        return next;
      });

      try {
        const result = await fullTranslationPipeline(pageUrls[index]);
        setPagesData(current => {
          const next = [...current];
          next[index] = { status: 'done', ...result };
          return next;
        });
      } catch (error) {
        console.error(`Failed to process page ${index + 1}:`, error);
        setPagesData(current => {
          const next = [...current];
          next[index] = { ...next[index], status: 'error' };
          return next;
        });
      }
    };

    // Process the current page and pre-fetch the next one.
    processPage(currentPageIndex);
    processPage(currentPageIndex + 1);

  }, [currentPageIndex, pageUrls, pagesData]);

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;

    setIsLoadingChapter(true);
    setPageUrls([]); // Clear previous chapter
    setPagesData([]);

    try {
      let urls: string[] = [];

      // Check if we are in "Pattern Mode" or "Chapter URL Mode"
      if (urlInput.includes('{{i}}')) {
        // --- PATTERN MODE (for Mangafreak) ---
        console.log("Detected URL Pattern. Generating URLs...");
        for (let i = startPage; i <= endPage; i++) {
          urls.push(urlInput.replace('{{i}}', String(i)));
        }
      } else {
        // --- CHAPTER URL MODE (for Comick) ---
        console.log("Detected Chapter URL. Fetching URL list from API...");
        const res = await fetch(`/api/get-chapter-urls?url=${encodeURIComponent(urlInput)}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(`Failed to fetch chapter URLs: ${errorData.error || res.statusText}`);
        }
        const data = await res.json();
        urls = data.urls;
      }

      if (!urls || urls.length === 0) {
        throw new Error('Could not generate or find any image URLs.');
      }

      // Set state with the final list of URLs
      setPageUrls(urls);
      setPagesData(Array(urls.length).fill({ status: 'pending' }));
      setCurrentPageIndex(0);

    } catch (error: any) {
      console.error(error);
      alert(`Error loading chapter: ${error.message}`);
    } finally {
      setIsLoadingChapter(false);
    }
  };
  
  const isPatternMode = urlInput.includes('{{i}}');
  const currentPage = pagesData[currentPageIndex];

  // The rest of the return statement (JSX) remains exactly the same.
  // ... (No changes needed in the JSX part of the component) ...
  return (
    <main>
      {pageUrls.length === 0 ? (
        <div className="form-container">
          <h1>Manga Translator</h1>
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="urlPattern">URL Pattern (use `{'{{i}}'}` for page number)</label>
              <input id="urlPattern" type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="e.g. https://site.com/manga/{{i}}.png" />
            </div>
            <div>
              <label htmlFor="startPage">Start Page</label>
              <input id="startPage" type="number" value={startPage} min="1" onChange={e => setStartPage(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="endPage">End Page</label>
              <input id="endPage" type="number" value={endPage} min={startPage} onChange={e => setEndPage(Number(e.target.value))} />
            </div>
            <button type="submit">Load Chapter</button>
          </form>
        </div>
      ) : (
        <div className="viewer-container">
          <div className="viewer-controls">
            <button onClick={() => setCurrentPageIndex(i => Math.max(i - 1, 0))} disabled={currentPageIndex === 0}>Previous</button>
            <span>Page {currentPageIndex + 1} of {pageUrls.length}</span>
            <button onClick={() => setCurrentPageIndex(i => Math.min(i + 1, pageUrls.length - 1))} disabled={currentPageIndex === pageUrls.length - 1}>Next</button>
          </div>
          <div className="viewer-display">
            {(!currentPage || currentPage.status === 'pending' || currentPage.status === 'loading') && <div className="loader">Processing Page...</div>}
            {currentPage?.status === 'error' && <div className="error">Failed to load this page.</div>}
            {currentPage?.status === 'done' && (
              <TranslationOverlay 
                imageSrc={currentPage.originalImage!}
                translatedBlocks={currentPage.translatedBlocks!}
                originalWidth={currentPage.originalWidth!}
                originalHeight={currentPage.originalHeight!}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}