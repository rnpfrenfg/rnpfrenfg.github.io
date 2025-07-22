"use client";

import { useRef } from "react";
import { Lock, Film, Music, Type, Image, ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";

interface TimelineProps {
  currentTime: number;
  onTimeChange: (time: number) => void;
  selectedTrack: string | null;
  onTrackSelect: (trackId: string | null) => void;
}

interface Track {
  id: string;
  name: string;
  type: "video" | "audio" | "text" | "image";
  color: string;
  startTime: number;
  duration: number;
  locked?: boolean;
  folderId: string;
}

interface TrackFolder {
  id: string;
  name: string;
  color?: string;
}

const folders: TrackFolder[] = [
  { id: "main", name: "Main Video", color: "text-green-400" },
  { id: "text", name: "Text Elements", color: "text-purple-400" },
  { id: "effects", name: "Effects", color: "text-blue-400" },
  { id: "background", name: "Background", color: "text-orange-400" },
];

const tracks: Track[] = [
  {
    id: "1",
    name: "234930_small.mp4",
    type: "video",
    color: "bg-green-600",
    startTime: 0,
    duration: 25,
    folderId: "main"
  },
  {
    id: "2",
    name: "Steve Ballmer at NE...",
    type: "video",
    color: "bg-green-500",
    startTime: 0,
    duration: 15,
    folderId: "main"
  },
  {
    id: "3",
    name: "TEXTELEMENT",
    type: "text",
    color: "bg-purple-600",
    startTime: 5,
    duration: 8,
    folderId: "text"
  },
  {
    id: "5",
    name: "TEXTELEMENT",
    type: "text",
    color: "bg-pink-600",
    startTime: 12,
    duration: 6,
    folderId: "text"
  },
  {
    id: "10",
    name: "TEXTELEMENT",
    type: "text",
    color: "bg-gray-700",
    startTime: 18,
    duration: 4,
    folderId: "text"
  },
  {
    id: "6",
    name: "POSITION",
    type: "video",
    color: "bg-blue-500",
    startTime: 0,
    duration: 25,
    folderId: "effects"
  },
  {
    id: "7",
    name: "OPACITY",
    type: "video",
    color: "bg-blue-500",
    startTime: 0,
    duration: 25,
    folderId: "effects"
  },
  {
    id: "8",
    name: "SCALE",
    type: "video",
    color: "bg-blue-500",
    startTime: 0,
    duration: 25,
    folderId: "effects"
  },
  {
    id: "4",
    name: "Group 1.png",
    type: "image",
    color: "bg-blue-600",
    startTime: 8,
    duration: 20,
    folderId: "background"
  },
  {
    id: "9",
    name: "creative-technology-sh...",
    type: "video",
    color: "bg-purple-700",
    startTime: 0,
    duration: 25,
    folderId: "background"
  },
  {
    id: "11",
    name: "image (1).webp",
    type: "image",
    color: "bg-orange-600",
    startTime: 22,
    duration: 3,
    folderId: "background"
  }
];

export function Timeline({
  currentTime,
  onTimeChange,
  selectedTrack,
  onTrackSelect
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const totalDuration = 25; // seconds
  const pixelsPerSecond = 50;

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 200; // Account for track labels width
    const time = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond));
    onTimeChange(time);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}${secs < 10 ? "s" : "s"}`;
  };

  const getTrackIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Film size={16} className="text-green-400" />;
      case "audio":
        return <Music size={16} className="text-blue-400" />;
      case "text":
        return <Type size={16} className="text-purple-400" />;
      case "image":
        return <Image size={16} className="text-orange-400" />;
      default:
        return <Film size={16} className="text-gray-400" />;
    }
  };

  const getTracksInFolder = (folderId: string) => {
    return tracks.filter(track => track.folderId === folderId);
  };

  return (
    <div className="h-80 bg-gray-900 border-t border-gray-700 flex-shrink-0">
      <style jsx>{`
        .folder-toggle {
          display: none;
        }
        
        .folder-content {
          max-height: 1000px;
          overflow: hidden;
          transition: max-height 0.3s ease-out;
        }
        
        .folder-toggle:checked + .folder-header + .folder-content {
          max-height: 0;
        }
        
        .folder-toggle:checked + .folder-header .chevron-down {
          display: none;
        }
        
        .folder-toggle:not(:checked) + .folder-header .chevron-right {
          display: none;
        }
        
        .folder-toggle:checked + .folder-header .folder-open {
          display: none;
        }
        
        .folder-toggle:not(:checked) + .folder-header .folder-closed {
          display: none;
        }
        
        .folder-header:hover {
          background-color: rgb(55 65 81);
        }
        
        .track-row:hover {
          background-color: rgb(55 65 81);
        }
        
        .track-block:hover {
          opacity: 0.8;
        }
        
        .resize-handle {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        
        .track-block:hover .resize-handle {
          opacity: 1;
        }
      `}</style>

      {/* Timeline Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center">
        <div className="w-48 px-4 text-sm text-gray-300 font-mono border-r border-gray-700">
          00:00:05.35
        </div>

        {/* Time Ruler */}
        <div
          className="flex-1 relative"
          ref={timelineRef}
          onClick={handleTimelineClick}
        >
          <div className="h-full flex items-center relative cursor-pointer">
            {/* Time markers */}
            {Array.from(
              { length: Math.ceil(totalDuration / 5) + 1 },
              (_, i) => (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${i * 5 * pixelsPerSecond}px` }}
                >
                  <div className="text-xs text-gray-400 mb-1">
                    {formatTime(i * 5)}
                  </div>
                  <div className="w-px h-4 bg-gray-600"></div>
                </div>
              )
            )}

            {/* Minor tick marks */}
            {Array.from({ length: totalDuration + 1 }, (_, i) => (
              <div
                key={`tick-${i}`}
                className="absolute w-px h-2 bg-gray-700 bottom-0"
                style={{ left: `${i * pixelsPerSecond}px` }}
              />
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 transform rotate-45"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks organized by folders */}
      <div className="flex-1 overflow-y-auto">
        {folders.map((folder) => {
          const folderTracks = getTracksInFolder(folder.id);
          
          return (
            <div key={folder.id}>
              {/* Hidden checkbox for CSS-only toggle */}
              <input
                type="checkbox"
                id={`folder-${folder.id}`}
                className="folder-toggle"
              />
              
              {/* Folder Header */}
              <label
                htmlFor={`folder-${folder.id}`}
                className="folder-header h-10 bg-gray-800 border-b border-gray-600 flex items-center cursor-pointer transition-colors block"
              >
                <div className="w-48 px-4 flex items-center space-x-2 border-r border-gray-700">
                  <div className="flex items-center space-x-1">
                    <ChevronDown size={14} className="text-gray-400 chevron-down" />
                    <ChevronRight size={14} className="text-gray-400 chevron-right" />
                    <FolderOpen size={16} className={`folder-open ${folder.color || "text-gray-400"}`} />
                    <Folder size={16} className={`folder-closed ${folder.color || "text-gray-400"}`} />
                  </div>
                  <span className="text-sm text-gray-200 font-medium">
                    {folder.name} ({folderTracks.length})
                  </span>
                </div>
                <div className="flex-1"></div>
              </label>

              {/* Folder Tracks */}
              <div className="folder-content">
                {folderTracks.map((track) => (
                  <div
                    key={track.id}
                    className={`track-row h-12 border-b border-gray-700 flex items-center transition-colors cursor-pointer ${
                      selectedTrack === track.id ? "bg-gray-700" : ""
                    }`}
                    onClick={() => onTrackSelect(track.id)}
                  >
                    {/* Track Label */}
                    <div className="w-48 px-4 flex items-center space-x-2 border-r border-gray-700">
                      <div className="w-4"></div> {/* Indent for folder structure */}
                      {getTrackIcon(track.type)}
                      <span className="text-sm text-gray-300 truncate flex-1">
                        {track.name}
                      </span>
                      {track.locked && <Lock size={12} className="text-gray-500" />}
                    </div>

                    {/* Track Content */}
                    <div className="flex-1 relative h-full">
                      <div
                        className={`track-block absolute h-8 top-2 rounded ${track.color} cursor-pointer transition-opacity shadow-sm`}
                        style={{
                          left: `${track.startTime * pixelsPerSecond}px`,
                          width: `${track.duration * pixelsPerSecond}px`
                        }}
                      >
                        <div className="h-full flex items-center px-2">
                          <span className="text-xs text-white truncate font-medium">
                            {track.name}
                          </span>
                        </div>

                        {/* Resize handles */}
                        <div className="resize-handle absolute left-0 top-0 bottom-0 w-1 bg-white bg-opacity-20 cursor-ew-resize transition-opacity"></div>
                        <div className="resize-handle absolute right-0 top-0 bottom-0 w-1 bg-white bg-opacity-20 cursor-ew-resize transition-opacity"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}