'use client';

import { useState } from 'react';

export default function Toolbar() {
  const [selectedTool, setSelectedTool] = useState('select');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('00:00:00');

  const tools = [
    { id: 'select', icon: 'ri-cursor-line', name: '선택' },
    { id: 'cut', icon: 'ri-scissors-line', name: '자르기' },
    { id: 'text', icon: 'ri-font-size-2', name: '텍스트' },
    { id: 'filter', icon: 'ri-camera-lens-line', name: '필터' },
    { id: 'transition', icon: 'ri-shuffle-line', name: '전환' },
    { id: 'audio', icon: 'ri-volume-up-line', name: '오디오' },
  ];

  const handlePlay = () => {
    setIsPlaying(true);
    // Simulate playback with timer
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setCurrentTime(`00:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    // Auto stop after demo (optional)
    setTimeout(() => {
      clearInterval(timer);
      setIsPlaying(false);
      setCurrentTime('00:02:15');
    }, 10000);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime('00:00:00');
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 bg-gray-700 rounded-lg p-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                selectedTool === tool.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
              title={tool.name}
            >
              <i className={`${tool.icon} text-lg`}></i>
            </button>
          ))}
        </div>
        
        <div className="h-6 w-px bg-gray-600 mx-4"></div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handlePlay}
            disabled={isPlaying}
            className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              isPlaying 
                ? 'bg-green-800 text-green-300' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <i className="ri-play-fill text-lg"></i>
          </button>
          <button 
            onClick={handlePause}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-pause-fill text-lg"></i>
          </button>
          <button 
            onClick={handleStop}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-stop-fill text-lg"></i>
          </button>
        </div>

        <div className="h-6 w-px bg-gray-600 mx-4"></div>

        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-sm whitespace-nowrap">{isPlaying ? currentTime : '00:02:15'}</span>
          <div className={`w-2 h-2 bg-red-500 rounded-full ${isPlaying ? 'animate-pulse' : ''}`}></div>
        </div>
      </div>
    </div>
  );
}