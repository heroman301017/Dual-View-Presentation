
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CameraView } from './components/CameraView';
import { ContentViewer } from './components/ContentViewer';
import { ViewMode } from './types';
// FIX: Removed import for 'SlidersHorizontal' which is not exported from './components/icons', and also removed other unused icon imports.
import { Download, FileUp, FlipHorizontal, Mic, Play, RefreshCw, Square, StickyNote, TimerIcon, SparklesIcon } from './components/icons';

const cameraFilters = {
  none: 'None',
  vibrant: 'Vibrant',
  soften: 'Soften',
  cool: 'Cool',
  warm: 'Warm',
  grayscale: 'Grayscale',
};
type CameraFilter = keyof typeof cameraFilters;

const App: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Presentation);
    const [file, setFile] = useState<File | null>(null);
    const [isMirrored, setIsMirrored] = useState(true);
    const [dividerPosition, setDividerPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    
    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState('');

    const [time, setTime] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const timerIntervalRef = useRef<number | null>(null);

    const [activeFilter, setActiveFilter] = useState<CameraFilter>('none');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const filterPanelRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const newDividerPosition = ((e.clientX - rect.left) / rect.width) * 100;
            if (newDividerPosition > 20 && newDividerPosition < 80) {
                setDividerPosition(newDividerPosition);
            }
        }
    }, [isDragging]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
          // A bit of a hack to prevent closing when the button itself is clicked
          const target = event.target as Element;
          if (!target.closest('#filter-button')) {
            setShowFilterPanel(false);
          }
        }
      };
      if (showFilterPanel) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showFilterPanel]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setFile(event.target.files[0]);
        }
    };
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetTimer = () => {
        setIsTimerRunning(false);
        setTime(0);
    };

    const startRecording = useCallback(() => {
        if (mediaStream) {
            // Reset timer and clear previous recording data
            resetTimer();
            setRecordedChunks([]);
            if (recordedVideoUrl) {
                URL.revokeObjectURL(recordedVideoUrl);
            }
            setRecordedVideoUrl(null); // Ensure playback modal is closed

            // Start new recording
            setIsRecording(true);
            
            const recorder = new MediaRecorder(mediaStream);
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    setRecordedChunks((prev) => [...prev, event.data]);
                }
            };
            recorder.start();
        }
    }, [mediaStream, recordedVideoUrl]);
    
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);
    
    useEffect(() => {
        if (!isRecording && recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedVideoUrl(url);
        }
    }, [isRecording, recordedChunks]);

    useEffect(() => {
      if (isTimerRunning) {
        timerIntervalRef.current = window.setInterval(() => {
          setTime(prevTime => prevTime + 1);
        }, 1000);
      } else {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }
      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }, [isTimerRunning]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const handleResetSession = () => {
        if (window.confirm("Are you sure you want to start a new session? This will clear your current file, notes, and recording progress.")) {
            if (isRecording) {
                stopRecording();
            }
            resetTimer();
            setFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            setRecordedChunks([]);
            setRecordedVideoUrl(null);
            setNotes('');
            setViewMode(ViewMode.Presentation);
        }
    };
    
    const hasRecording = recordedChunks.length > 0;

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-900 text-white select-none">
            {recordedVideoUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-4 rounded-lg shadow-2xl max-w-4xl w-full">
                        <h2 className="text-xl font-bold mb-4">Playback</h2>
                        <video src={recordedVideoUrl} controls autoPlay className="w-full rounded-md"></video>
                        <div className="mt-4 flex justify-end gap-4">
                            <a href={recordedVideoUrl} download={`rehearsal-${new Date().toISOString()}.webm`} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors">
                                <Download className="h-5 w-5" /> Download
                            </a>
                            <button onClick={() => { setRecordedVideoUrl(null); }} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}
            <main ref={containerRef} className="flex-grow flex h-full relative overflow-hidden">
                <div className="h-full" style={{ width: `${dividerPosition}%` }}>
                    <CameraView 
                      isMirrored={isMirrored} 
                      onStreamReady={setMediaStream}
                      filterClassName={`filter-${activeFilter}`}
                    />
                </div>
                <div onMouseDown={handleMouseDown} className="w-2 h-full bg-gray-700 hover:bg-blue-500 cursor-col-resize absolute top-0 bottom-0 z-10 transition-colors" style={{ left: `calc(${dividerPosition}% - 4px)` }}></div>
                <div className="h-full" style={{ width: `calc(100% - ${dividerPosition}%)` }}>
                    <ContentViewer 
                        file={file} 
                        viewMode={viewMode} 
                        onUploadClick={() => fileInputRef.current?.click()}
                    />
                </div>
            </main>

            {showNotes && (
                <div className="absolute bottom-20 left-4 right-4 z-20">
                     <textarea
                        className="w-full h-32 p-3 bg-gray-800 bg-opacity-90 border border-gray-700 rounded-lg shadow-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Your script or bullet points..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                     ></textarea>
                </div>
            )}

            <footer className="w-full bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 p-2 flex items-center justify-between z-30">
                <div className="flex items-center gap-2">
                     <button onClick={handleResetSession} className="p-2 rounded-md hover:bg-gray-700 transition-colors" title="New Session">
                        <RefreshCw className="h-6 w-6" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-md hover:bg-gray-700 transition-colors" title="Upload Document">
                        <FileUp className="h-6 w-6" />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                    
                    <div className="h-6 w-px bg-gray-600"></div>

                    <button onClick={() => setViewMode(ViewMode.Document)} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === ViewMode.Document ? 'bg-blue-600' : 'hover:bg-gray-700'} transition-colors`} title="Document Mode">
                        Document
                    </button>
                    <button onClick={() => setViewMode(ViewMode.Presentation)} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === ViewMode.Presentation ? 'bg-blue-600' : 'hover:bg-gray-700'} transition-colors`} title="Presentation Mode">
                        Presentation
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsTimerRunning(prev => !prev)} 
                        className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title={isTimerRunning ? "Pause Timer" : "Start Timer"}
                    >
                        <TimerIcon className={`h-5 w-5 transition-colors ${isTimerRunning ? 'text-yellow-400 animate-pulse' : 'text-gray-400'}`} />
                        <span className={`font-mono text-lg transition-colors ${isTimerRunning ? 'text-yellow-400' : ''}`}>{formatTime(time)}</span>
                    </button>
                    
                    {isRecording ? (
                        <button onClick={stopRecording} className="p-2 rounded-full bg-red-600 animate-pulse" title="Stop Recording">
                            <Square className="h-6 w-6" />
                        </button>
                    ) : (
                        <button 
                            onClick={startRecording} 
                            disabled={!mediaStream} 
                            className="p-2 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed transition-colors flex items-center gap-2" 
                            title={hasRecording ? "Start New Recording" : "Start Recording"}
                        >
                            {hasRecording ? <RefreshCw className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                        </button>
                    )}
                    
                    {hasRecording && !isRecording && (
                        <button onClick={() => setRecordedVideoUrl(URL.createObjectURL(new Blob(recordedChunks, { type: 'video/webm' })))} className="p-2 rounded-md hover:bg-gray-700 transition-colors" title="Playback Last Recording">
                            <Play className="h-6 w-6" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setShowNotes(!showNotes)} className={`p-2 rounded-md ${showNotes ? 'bg-blue-600' : 'hover:bg-gray-700'} transition-colors`} title={showNotes ? "Hide Notes" : "Show Notes"}>
                        <StickyNote className="h-6 w-6" />
                    </button>
                    <div className="relative">
                        <button 
                          id="filter-button"
                          onClick={() => setShowFilterPanel(prev => !prev)} 
                          className={`p-2 rounded-md ${showFilterPanel ? 'bg-blue-600' : 'hover:bg-gray-700'} transition-colors`} 
                          title="Camera Effects"
                        >
                            <SparklesIcon className="h-6 w-6" />
                        </button>
                        {showFilterPanel && (
                          <div ref={filterPanelRef} className="absolute bottom-full right-0 mb-2 w-40 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-40">
                              <div className="p-2">
                                  <p className="text-sm font-semibold text-gray-300 px-2 pb-1">Camera Filters</p>
                                  {Object.entries(cameraFilters).map(([key, name]) => (
                                      <button
                                          key={key}
                                          onClick={() => {
                                              setActiveFilter(key as CameraFilter);
                                              setShowFilterPanel(false);
                                          }}
                                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${activeFilter === key ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
                                      >
                                          {name}
                                      </button>
                                  ))}
                              </div>
                          </div>
                        )}
                    </div>
                    <button onClick={() => setIsMirrored(!isMirrored)} className="p-2 rounded-md hover:bg-gray-700 transition-colors" title="Mirror Camera">
                        <FlipHorizontal className="h-6 w-6" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default App;