'use client';

import { useState } from 'react';

export default function Preview() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="bg-black flex-1 flex items-center justify-center relative">
      <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <img 
          src="https://readdy.ai/api/search-image?query=modern%20video%20editing%20workspace%20with%20multiple%20monitors%20displaying%20colorful%20video%20clips%20and%20professional%20lighting%20setup%20in%20a%20creative%20studio%20environment&width=800&height=450&seq=preview1&orientation=landscape"
          alt="비디오 프리뷰"
          className="w-full h-full object-cover object-top"
        />
        
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-20 h-20 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors cursor-pointer"
            >
              <i className="ri-play-fill text-4xl text-white ml-1"></i>
            </button>
          </div>
        )}

        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-white text-sm">1920x1080 • 30fps</span>
        </div>

        <div className="absolute top-4 right-4 flex space-x-2">
          <button className="w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition-colors cursor-pointer">
            <i className="ri-fullscreen-line text-white"></i>
          </button>
          <button className="w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition-colors cursor-pointer">
            <i className="ri-settings-3-line text-white"></i>
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <span className="text-white text-sm whitespace-nowrap">00:15</span>
              <div className="flex-1 bg-gray-600 rounded-full h-2 relative">
                <div className="bg-blue-500 h-2 rounded-full w-1/3"></div>
                <div className="absolute top-0 left-1/3 w-4 h-4 bg-blue-500 rounded-full -mt-1 cursor-pointer"></div>
              </div>
              <span className="text-white text-sm whitespace-nowrap">01:45</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}