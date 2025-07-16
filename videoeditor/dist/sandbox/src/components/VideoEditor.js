"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Timeline } from "./Timeline";
import { PreviewPanel } from "./PreviewPanel";
import { PropertiesPanel } from "./PropertiesPanel";
export function VideoEditor() {
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [currentTime, setCurrentTime] = useState(5.35);
    const [isPlaying, setIsPlaying] = useState(false);
    return (<div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden" data-oid="jv-f9ii">

      {/* Top Bar */}

      <div className="flex-1 flex min-h-0" data-oid="pca30fx" key="olk-5_Xx">
        {/* Left Sidebar */}
        <Sidebar data-oid="lfo8z8q"/>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0" data-oid=":um19ta">
          {/* Preview and Properties */}
          <div className="flex-1 flex min-h-0" data-oid="xic0i1.">
            <PreviewPanel currentTime={currentTime} isPlaying={isPlaying} onPlayPause={() => setIsPlaying(!isPlaying)} data-oid="lzbdq9z"/>


            <PropertiesPanel selectedTrack={selectedTrack} data-oid="1.-w-lc"/>
          </div>

          {/* Timeline */}
          <Timeline currentTime={currentTime} onTimeChange={setCurrentTime} selectedTrack={selectedTrack} onTrackSelect={setSelectedTrack} data-oid="aposiu6"/>

        </div>
      </div>
    </div>);
}
