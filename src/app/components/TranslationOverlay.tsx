"use client";

import { useState, useEffect, useRef } from 'react';

// Define types
interface Bbox { x0: number; y0: number; x1: number; y1: number; }
interface TranslatedBlock { bbox: Bbox; translation: string; }
interface Props {
  imageSrc: string;
  translatedBlocks: TranslatedBlock[];
  originalWidth: number;
  originalHeight: number;
}

export default function TranslationOverlay({ imageSrc, translatedBlocks, originalWidth, originalHeight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // A ResizeObserver is more efficient than a window resize event listener
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && originalWidth > 0) {
        const displayedWidth = entry.contentRect.width;
        setScale(displayedWidth / originalWidth);
      }
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [originalWidth]); // Rerun when the original image width changes

  if (!originalWidth) return null; // Don't render if we don't have dimensions yet

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', lineHeight: 1, width: '100%' }}>
      <img src={imageSrc} alt="Translated Comic" style={{ maxWidth: '100%', display: 'block', width: '100%' }} />
      {translatedBlocks.map((block, index) => {
        // Calculate responsive font size, with a minimum to prevent it from being unreadable
        const responsiveFontSize = Math.max(8, 14 * scale);

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              // Apply the scale factor to all position and size properties
              left: `${block.bbox.x0 * scale}px`,
              top: `${block.bbox.y0 * scale}px`,
              width: `${(block.bbox.x1 - block.bbox.x0) * scale}px`,
              height: `${(block.bbox.y1 - block.bbox.y0) * scale}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid black',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: `${2 * scale}px`,
              fontSize: `${responsiveFontSize}px`,
              fontWeight: 'bold',
              textAlign: 'center',
              overflow: 'hidden',
              boxSizing: 'border-box', // Ensure padding is included in width/height
            }}
          >
            {block.translation}
          </div>
        );
      })}
    </div>
  );
}