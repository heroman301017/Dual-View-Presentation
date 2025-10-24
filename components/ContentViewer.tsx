import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode } from '../types';
import { ChevronLeft, ChevronRight, FileUp } from './icons';

// Make TypeScript aware of the globally available pdfjsLib from the script tag in index.html
declare const pdfjsLib: any;

interface ContentViewerProps {
  file: File | null;
  viewMode: ViewMode;
  onUploadClick: () => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-lg text-gray-300">Converting PDF to images...</p>
    </div>
);

interface NoFileViewProps {
    onClick: () => void;
}

const NoFileView: React.FC<NoFileViewProps> = ({ onClick }) => (
    <div 
        className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8 cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={onClick}
        role="button"
        aria-label="Upload a document"
    >
        <FileUp className="w-24 h-24 mb-4 text-gray-500" />
        <h2 className="text-2xl font-bold mb-2 text-white">No Document Loaded</h2>
        <p>Click here or use the "Upload Document" button below to select a PDF file.</p>
    </div>
);

export const ContentViewer: React.FC<ContentViewerProps> = ({ file, viewMode, onUploadClick }) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setImageUrls([]);
      setCurrentPage(1);
      setError(null);
      return;
    }

    const convertPdfToImages = async () => {
      try {
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);
        fileReader.onload = async (event) => {
          if (!event.target?.result) {
            setError("Failed to read the file.");
            setIsLoading(false);
            return;
          }
          
          const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          const numPages = pdf.numPages;
          const urls: string[] = [];
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) {
            setError("Could not create canvas context for rendering.");
            setIsLoading(false);
            return;
          }
          
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            urls.push(canvas.toDataURL('image/jpeg', 0.9)); // 90% quality JPEG
          }
          
          setImageUrls(urls);
          setIsLoading(false);
        };
        fileReader.onerror = () => {
          setError("Error reading file.");
          setIsLoading(false);
        }
      } catch (e: any) {
        console.error('Error converting PDF:', e);
        setError(`Failed to process PDF: ${e.message}`);
        setIsLoading(false);
      }
    };
    
    const checkPdfLibAndProcess = (retryCount = 0) => {
        if (typeof pdfjsLib !== 'undefined') {
            // Switched to jsDelivr CDN for the worker as well to ensure consistency and reliability
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
            convertPdfToImages();
        } else if (retryCount < 50) { // ~5 seconds timeout
            setTimeout(() => checkPdfLibAndProcess(retryCount + 1), 100);
        } else {
            setError("PDF processing library failed to load. Please refresh the page.");
            setIsLoading(false);
        }
    };
    
    // Reset state and start processing when a new file is provided
    setIsLoading(true);
    setError(null);
    setImageUrls([]);
    setCurrentPage(1);
    checkPdfLibAndProcess();
    
  }, [file]);
  
  const numPages = imageUrls.length;

  const goToPrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    if (numPages) {
      setCurrentPage(prev => Math.min(prev + 1, numPages));
    }
  }, [numPages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (viewMode === ViewMode.Presentation) {
        if (event.key === 'ArrowRight') {
          goToNextPage();
        } else if (event.key === 'ArrowLeft') {
          goToPrevPage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewMode, goToNextPage, goToPrevPage]);

  const renderContent = () => {
    if (isLoading) {
        return <div className="absolute inset-0 bg-gray-800/80 z-20"><LoadingSpinner /></div>;
    }
    
    if (error) {
      return <div className="flex flex-col items-center justify-center h-full text-red-400 text-center p-4">
        <h3 className="font-bold text-lg mb-2">Failed to load document</h3>
        <p>{error}</p>
      </div>;
    }
    
    if (!file) {
      return <NoFileView onClick={onUploadClick} />;
    }
    
    if (imageUrls.length === 0) {
      return null; // Don't show anything until loading is done or an error occurs
    }

    if (viewMode === ViewMode.Document) {
      return (
        <div className="p-4 space-y-4 flex flex-col items-center flex-grow overflow-auto">
          {imageUrls.map((url, index) => (
            <div key={`page_${index + 1}`} className="shadow-lg">
              <img src={url} alt={`Page ${index + 1}`} className="max-w-full h-auto" />
            </div>
          ))}
        </div>
      );
    }

    if (viewMode === ViewMode.Presentation && numPages > 0) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4 relative">
          <div className="shadow-lg h-full w-full flex items-center justify-center">
              <img src={imageUrls[currentPage - 1]} alt={`Page ${currentPage}`} className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="w-full h-full bg-gray-800 flex flex-col relative overflow-hidden">
        {renderContent()}
        
        {viewMode === ViewMode.Presentation && numPages > 0 && !isLoading && !error && (
             <div className="absolute inset-0 flex items-center justify-between p-2 z-10 pointer-events-none">
                <button onClick={goToPrevPage} disabled={currentPage <= 1} className="p-2 rounded-full bg-black bg-opacity-40 hover:bg-opacity-60 disabled:opacity-20 disabled:cursor-not-allowed transition-opacity pointer-events-auto">
                    <ChevronLeft className="h-8 w-8" />
                </button>
                <button onClick={goToNextPage} disabled={currentPage >= numPages} className="p-2 rounded-full bg-black bg-opacity-40 hover:bg-opacity-60 disabled:opacity-20 disabled:cursor-not-allowed transition-opacity pointer-events-auto">
                    <ChevronRight className="h-8 w-8" />
                </button>
            </div>
        )}
        
        {numPages > 0 && !isLoading && !error && (
             <div className="absolute bottom-2 right-4 bg-black/50 px-3 py-1 rounded-full text-sm font-mono">
                {currentPage} / {numPages}
            </div>
        )}
    </div>
  );
};