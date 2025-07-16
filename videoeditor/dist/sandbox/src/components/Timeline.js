"use client";
import { useState, useRef } from "react";
import { Lock, Film, Music, Type, Image, ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
const folders = [
    { id: "main", name: "Main Video", collapsed: false, color: "text-green-400" },
    {
        id: "text",
        name: "Text Elements",
        collapsed: false,
        color: "text-purple-400"
    },
    { id: "effects", name: "Effects", collapsed: false, color: "text-blue-400" },
    {
        id: "background",
        name: "Background",
        collapsed: false,
        color: "text-orange-400"
    }
];
const tracks = [
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
export function Timeline({ currentTime, onTimeChange, selectedTrack, onTrackSelect }) {
    const timelineRef = useRef(null);
    const [folderStates, setFolderStates] = useState(folders.reduce((acc, folder) => ({ ...acc, [folder.id]: !folder.collapsed }), {}));
    const totalDuration = 25; // seconds
    const pixelsPerSecond = 50;
    const handleTimelineClick = (e) => {
        if (!timelineRef.current)
            return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 200; // Account for track labels width
        const time = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond));
        onTimeChange(time);
    };
    const toggleFolder = (folderId) => {
        setFolderStates((prev) => ({
            ...prev,
            [folderId]: !prev[folderId]
        }));
    };
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}${secs < 10 ? "s" : "s"}`;
    };
    const getTrackIcon = (type) => {
        switch (type) {
            case "video":
                return <Film size={16} className="text-green-400" data-oid="cputvk6"/>;
            case "audio":
                return <Music size={16} className="text-blue-400" data-oid="qtue8gt"/>;
            case "text":
                return <Type size={16} className="text-purple-400" data-oid="ygqlkd."/>;
            case "image":
                return <Image size={16} className="text-orange-400" data-oid="dgg0l6q"/>;
            default:
                return <Film size={16} className="text-gray-400" data-oid="gwjcloi"/>;
        }
    };
    const getTracksInFolder = (folderId) => {
        return tracks.filter((track) => track.folderId === folderId);
    };
    return (<div className="h-80 bg-gray-900 border-t border-gray-700 flex-shrink-0" data-oid="0q413oc">
      {/* Timeline Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center" data-oid="6m9fvi.">
        <div className="w-48 px-4 text-sm text-gray-300 font-mono border-r border-gray-700" data-oid="cd97moa">
          00:00:05.35
        </div>

        {/* Time Ruler */}
        <div className="flex-1 relative" ref={timelineRef} onClick={handleTimelineClick} data-oid="r.9a6qn">

          <div className="h-full flex items-center relative cursor-pointer" data-oid="2otec88">
            {/* Time markers */}
            {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }, (_, i) => <div key={i} className="absolute flex flex-col items-center" style={{ left: `${i * 5 * pixelsPerSecond}px` }} data-oid="y5.m3ws">

                  <div className="text-xs text-gray-400 mb-1" data-oid="tdx4jp8">
                    {formatTime(i * 5)}
                  </div>
                  <div className="w-px h-4 bg-gray-600" data-oid="mz31w:9"></div>
                </div>)}

            {/* Minor tick marks */}
            {Array.from({ length: totalDuration + 1 }, (_, i) => <div key={`tick-${i}`} className="absolute w-px h-2 bg-gray-700 bottom-0" style={{ left: `${i * pixelsPerSecond}px` }} data-oid="93lau15"/>)}

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none" style={{ left: `${currentTime * pixelsPerSecond}px` }} data-oid="43t9wlg">

              <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 transform rotate-45" data-oid="jkiudgp"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks organized by folders */}
      <div className="flex-1 overflow-y-auto" data-oid="mw28n3x">
        {folders.map((folder) => {
            const folderTracks = getTracksInFolder(folder.id);
            const isExpanded = folderStates[folder.id];
            return (<div key={folder.id} data-oid="_737uyp">
              {/* Folder Header */}
              <div className="h-10 bg-gray-800 border-b border-gray-600 flex items-center cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => toggleFolder(folder.id)} data-oid="ap7bm_8">

                <div className="w-48 px-4 flex items-center space-x-2 border-r border-gray-700" data-oid="bc5ibti">
                  <div className="flex items-center space-x-1" data-oid="49nxj20">
                    {isExpanded ?
                    <ChevronDown size={14} className="text-gray-400" data-oid="a7_x:xm"/> :
                    <ChevronRight size={14} className="text-gray-400" data-oid="gqvomcn"/>}
                    {isExpanded ?
                    <FolderOpen size={16} className={folder.color || "text-gray-400"} data-oid="qllfy.."/> :
                    <Folder size={16} className={folder.color || "text-gray-400"} data-oid="wkb7n4u"/>}
                  </div>
                  <span className="text-sm text-gray-200 font-medium" data-oid="_qs4_cd">
                    {folder.name} ({folderTracks.length})
                  </span>
                </div>
                <div className="flex-1" data-oid="rx-9jep"></div>
              </div>

              {/* Folder Tracks */}
              {isExpanded &&
                    folderTracks.map((track) => <div key={track.id} className={`h-12 border-b border-gray-700 flex items-center hover:bg-gray-800 transition-colors cursor-pointer ${selectedTrack === track.id ? "bg-gray-700" : ""}`} onClick={() => onTrackSelect(track.id)} data-oid="nwnq05_">

                    {/* Track Label */}
                    <div className="w-48 px-4 flex items-center space-x-2 border-r border-gray-700" data-oid="jzk_mmr">
                      <div className="w-4" data-oid="ac0:_tm"></div>{" "}
                      {/* Indent for folder structure */}
                      {getTrackIcon(track.type)}
                      <span className="text-sm text-gray-300 truncate flex-1" data-oid="sthedd6">
                        {track.name}
                      </span>
                      {track.locked &&
                            <Lock size={12} className="text-gray-500" data-oid="gikqlbr"/>}
                    </div>

                    {/* Track Content */}
                    <div className="flex-1 relative h-full" data-oid="7hz4ni7">
                      <div className={`absolute h-8 top-2 rounded ${track.color} cursor-pointer hover:opacity-80 transition-opacity shadow-sm`} style={{
                            left: `${track.startTime * pixelsPerSecond}px`,
                            width: `${track.duration * pixelsPerSecond}px`
                        }} data-oid="wha-m6c">

                        <div className="h-full flex items-center px-2" data-oid="9x_y_vy">
                          <span className="text-xs text-white truncate font-medium" data-oid="y5nuu-s">
                            {track.name}
                          </span>
                        </div>

                        {/* Resize handles */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white bg-opacity-20 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity" data-oid="q7wdf1v"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white bg-opacity-20 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity" data-oid="ef3fewl"></div>
                      </div>
                    </div>
                  </div>)}
            </div>);
        })}
      </div>
    </div>);
}
