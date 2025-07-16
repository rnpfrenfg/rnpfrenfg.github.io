"use client";
import { useState } from "react";
import { Settings, Folder, Type, Users, Puzzle, BarChart3, Music, Image, FileText, Film } from "lucide-react";
const mediaFiles = [
    { name: "hit.mp3", type: "audio" },
    { name: "iloveimg-...", type: "image" },
    { name: "image (1)...", type: "image" },
    { name: "image.webp", type: "image" },
    { name: "image (2)...", type: "image" },
    { name: "image2.png", type: "image" },
    { name: "img1.gif", type: "image" },
    { name: "keyframe...", type: "text" },
    { name: "keyframe...", type: "text" },
    { name: "logiopto...", type: "text" },
    { name: "lost-in-dr...", type: "text" },
    { name: "mergeau...", type: "text" }
];
export function Sidebar() {
    const [activeTab, setActiveTab] = useState("media");
    const getFileIcon = (type) => {
        switch (type) {
            case "audio":
                return <Music size={20} className="text-blue-400" data-oid=":z8.h2_"/>;
            case "video":
                return <Film size={20} className="text-green-400" data-oid="fnp_hvj"/>;
            case "image":
                return <Image size={20} className="text-purple-400" data-oid="flz:g_7"/>;
            case "text":
                return <FileText size={20} className="text-yellow-400" data-oid="6do7_0a"/>;
            default:
                return <FileText size={20} className="text-gray-400" data-oid="jz_uvvc"/>;
        }
    };
    return (<div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0" data-oid="lzihqt4">
      {/* Sidebar Navigation */}
      <div className="flex flex-col p-2 space-y-1 border-b border-gray-700" data-oid="u02y4l3">
        <button className="p-2 rounded hover:bg-gray-700 flex items-center justify-center transition-colors" data-oid="e2:jdsp">
          <Settings size={18} data-oid="ki-jt7h"/>
        </button>
        <button className="p-2 rounded bg-gray-700 flex items-center justify-center" data-oid="7314289">
          <Folder size={18} data-oid="qv-yqi."/>
        </button>
        <button className="p-2 rounded hover:bg-gray-700 flex items-center justify-center transition-colors" data-oid="q35ifn_">
          <Type size={18} data-oid="w6oroa2"/>
        </button>
        <button className="p-2 rounded hover:bg-gray-700 flex items-center justify-center transition-colors" data-oid="nx03yy2">
          <Users size={18} data-oid="w9i1ker"/>
        </button>
        <button className="p-2 rounded hover:bg-gray-700 flex items-center justify-center transition-colors" data-oid="l1mx2-a">
          <Puzzle size={18} data-oid="8k16ux_"/>
        </button>
        <button className="p-2 rounded hover:bg-gray-700 flex items-center justify-center transition-colors" data-oid="-i7d5h7">
          <BarChart3 size={18} data-oid="hxqnt9x"/>
        </button>
      </div>

      {/* Media Files */}
      <div className="flex-1 p-4 overflow-y-auto" data-oid="o-0y6oi">
        <div className="grid grid-cols-3 gap-2" data-oid="vr840x5">
          {mediaFiles.map((file, index) => <div key={index} className="bg-gray-700 rounded p-2 cursor-pointer hover:bg-gray-600 transition-colors" draggable onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify(file));
            }} data-oid=".:m_j:t">

              <div className="aspect-square bg-gray-600 rounded mb-1 flex items-center justify-center" data-oid="nnsy-t3">
                {getFileIcon(file.type)}
              </div>
              <div className="text-xs text-gray-300 truncate text-center" data-oid="yw.p.af">
                {file.name}
              </div>
            </div>)}
        </div>
      </div>
    </div>);
}
