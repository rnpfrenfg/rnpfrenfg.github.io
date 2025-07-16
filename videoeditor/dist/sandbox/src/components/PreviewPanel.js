"use client";
import { Play, Pause, Square, ZoomIn, ZoomOut } from "lucide-react";
export function PreviewPanel({ currentTime, isPlaying, onPlayPause }) {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor(seconds % 1 * 30);
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
    };
    return (<div className="flex-1 bg-gray-900 p-4 flex flex-col min-w-0" data-oid="9si9489">
      {/* Preview Area */}
      <div className="relative bg-black rounded-lg overflow-hidden mb-4 flex-1" style={{ minHeight: "400px" }} data-oid="0z5g1mj">

        {/* Video Preview Background */}
        <div className="absolute inset-0" data-oid="xeghrf-">
          {/* Mountain landscape background */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-300 via-blue-400 to-green-600" data-oid="xdibjyn"></div>

          {/* Mountain silhouettes */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2" data-oid="h3-8of:">
            <svg viewBox="0 0 400 200" className="w-full h-full" data-oid="7ojla2g">
              <polygon points="0,200 80,50 160,120 240,30 320,90 400,60 400,200" fill="#2d3748" opacity="0.8" data-oid="1._5uok"/>

              <polygon points="0,200 60,80 140,140 220,60 300,110 380,80 400,200" fill="#1a202c" opacity="0.6" data-oid="n074mvz"/>

            </svg>
          </div>
        </div>

        {/* LATE BIRD text */}
        <div className="absolute top-8 left-8 text-white" data-oid="vr-xvcq">
          <div className="text-2xl font-bold tracking-wider" data-oid="exex.l0">LATE</div>
          <div className="text-2xl font-bold tracking-wider" data-oid="dm6h._c">BIRD</div>
        </div>

        {/* Sample video element (Steve Ballmer) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-blue-500 rounded-lg overflow-hidden" data-oid="ap4oxt3">
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center" data-oid="pu46n8h">
            <div className="text-white text-sm font-semibold" data-oid="6gyuti_">
              Steve Ballmer
            </div>
          </div>
        </div>

        {/* Sample text overlay */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 px-4 py-2 rounded" data-oid="-ng1bsu">
          <span className="text-white font-semibold" data-oid="0he3l.g">This is Title</span>
        </div>

        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-20" data-oid="g50d:vl">
          <button onClick={onPlayPause} className="w-16 h-16 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-75 transition-all" data-oid=":gukmzq">

            {isPlaying ?
            <Pause size={24} data-oid="0xzkbd3"/> :
            <Play size={24} className="ml-1" data-oid="2qr1w0_"/>}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-4 flex-shrink-0" data-oid="hipu9k-">
        <button onClick={onPlayPause} className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors" data-oid="sbm9r3m">

          {isPlaying ?
            <Pause size={16} data-oid="xuztj0d"/> :
            <Play size={16} className="ml-0.5" data-oid="yw09b4w"/>}
        </button>

        <button className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors" data-oid="alvhyxn">
          <Square size={16} data-oid="k5t5xp1"/>
        </button>

        <div className="text-sm text-gray-300 font-mono" data-oid="tp9zz0b">
          {formatTime(currentTime)}
        </div>

        <div className="flex items-center space-x-2 ml-auto" data-oid="cpwc7do">
          <button className="p-2 text-gray-400 hover:text-white transition-colors" data-oid="1x-3raw">
            <ZoomOut size={16} data-oid="jkrk38d"/>
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors" data-oid="1h.e8wz">
            <ZoomIn size={16} data-oid="_8o35t6"/>
          </button>
        </div>
      </div>
    </div>);
}
