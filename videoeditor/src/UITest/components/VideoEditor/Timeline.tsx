
'use client';

import { useState } from 'react';

export default function Timeline() {
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [selectedClip, setSelectedClip] = useState<number | null>(null);

  const tracks = [
    { 
      id: 0, 
      name: '비디오 1', 
      type: 'video',
      clips: [
        { id: 1, start: 0, duration: 30, name: '인트로.mp4', color: 'bg-blue-500' },
        { id: 2, start: 30, duration: 45, name: '메인영상.mp4', color: 'bg-green-500' },
        { id: 3, start: 75, duration: 15, name: '아웃트로.mp4', color: 'bg-purple-500' }
      ]
    },
    { 
      id: 1, 
      name: '비디오 2', 
      type: 'video',
      clips: [
        { id: 4, start: 20, duration: 25, name: '오버레이.mp4', color: 'bg-orange-500' }
      ]
    },
    { 
      id: 2, 
      name: '오디오 1', 
      type: 'audio',
      clips: [
        { id: 5, start: 0, duration: 90, name: '배경음악.mp3', color: 'bg-red-500' }
      ]
    },
    { 
      id: 3, 
      name: '텍스트', 
      type: 'text',
      clips: [
        { id: 6, start: 10, duration: 20, name: '제목 텍스트', color: 'bg-yellow-500' },
        { id: 7, start: 60, duration: 10, name: '엔딩 크레딧', color: 'bg-pink-500' }
      ]
    }
  ];

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'video': return 'ri-video-line';
      case 'audio': return 'ri-volume-up-line';
      case 'text': return 'ri-font-size-2';
      default: return 'ri-file-line';
    }
  };

  const handleClipClick = (clipId: number) => {
    setSelectedClip(clipId === selectedClip ? null : clipId);
  };

  const getSelectedClipDetails = () => {
    if (!selectedClip) return null;
    
    for (const track of tracks) {
      const clip = track.clips.find(c => c.id === selectedClip);
      if (clip) {
        return { ...clip, trackType: track.type };
      }
    }
    return null;
  };

  const selectedClipDetails = getSelectedClipDetails();

  return (
    <div className="bg-gray-800 border-t border-gray-700 h-80 relative">
      <div className="flex h-full">
        <div className="w-48 bg-gray-900 border-r border-gray-700">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-white font-medium">타임라인</h3>
          </div>
          <div className="space-y-1 p-2">
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrack(track.id)}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  selectedTrack === track.id 
                    ? 'bg-blue-600' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${getTrackIcon(track.type)} text-gray-300`}></i>
                  </div>
                  <span className="text-white text-sm whitespace-nowrap">{track.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="h-8 bg-gray-700 border-b border-gray-600 flex items-center px-4">
            <div className="flex space-x-8">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-gray-400 text-xs">0:{i.toString().padStart(2, '0')}</span>
                  <div className="w-px h-2 bg-gray-500"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-2 space-y-2">
            {tracks.map((track) => (
              <div key={track.id} className="h-12 bg-gray-700 rounded relative">
                <div className="flex items-center space-x-1 p-1">
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      onClick={() => handleClipClick(clip.id)}
                      className={`h-10 ${clip.color} rounded px-2 flex items-center cursor-pointer hover:opacity-80 transition-all border-2 ${
                        selectedClip === clip.id ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ width: `${clip.duration * 4}px`, marginLeft: `${clip.start * 4}px` }}
                    >
                      <span className="text-white text-xs whitespace-nowrap overflow-hidden">{clip.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="absolute left-52 top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"></div>
        </div>
      </div>

      {selectedClipDetails && (
        <div className="absolute bottom-0 right-0 w-80 bg-gray-900 border-l border-t border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium">Clip Properties</h4>
            <button 
              onClick={() => setSelectedClip(null)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-sm">Name</label>
              <input 
                type="text" 
                value={selectedClipDetails.name}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                readOnly
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm">Start Time</label>
                <input 
                  type="text" 
                  value={`0:${Math.floor(selectedClipDetails.start / 60).toString().padStart(2, '0')}:${(selectedClipDetails.start % 60).toString().padStart(2, '0')}`}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Duration</label>
                <input 
                  type="text" 
                  value={`0:${Math.floor(selectedClipDetails.duration / 60).toString().padStart(2, '0')}:${(selectedClipDetails.duration % 60).toString().padStart(2, '0')}`}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-sm">Volume</label>
              <div className="flex items-center space-x-2 mt-1">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  defaultValue="75"
                  className="flex-1"
                />
                <span className="text-white text-sm w-8">75%</span>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors cursor-pointer whitespace-nowrap">
                Apply Changes
              </button>
              <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
