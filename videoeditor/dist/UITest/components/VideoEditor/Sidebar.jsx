'use client';
import { useState } from 'react';
export default function Sidebar() {
    const [activeTab, setActiveTab] = useState('media');
    const tabs = [
        { id: 'media', icon: 'ri-folder-2-line', name: '미디어' },
        { id: 'effects', icon: 'ri-magic-line', name: '효과' },
        { id: 'audio', icon: 'ri-music-line', name: '음악' },
        { id: 'text', icon: 'ri-text', name: '텍스트' },
    ];
    const mediaFiles = [
        { id: 1, name: '인트로영상.mp4', type: 'video', duration: '00:30', size: '15.2MB' },
        { id: 2, name: '메인컨텐츠.mp4', type: 'video', duration: '02:15', size: '89.5MB' },
        { id: 3, name: '배경음악.mp3', type: 'audio', duration: '03:45', size: '8.7MB' },
        { id: 4, name: '효과음.wav', type: 'audio', duration: '00:05', size: '2.1MB' },
        { id: 5, name: '로고이미지.png', type: 'image', size: '1.8MB' },
    ];
    const effects = [
        { id: 1, name: '페이드 인', category: '전환', preview: 'bg-gradient-to-r from-transparent to-blue-500' },
        { id: 2, name: '페이드 아웃', category: '전환', preview: 'bg-gradient-to-r from-blue-500 to-transparent' },
        { id: 3, name: '블러', category: '필터', preview: 'bg-blue-500 blur-sm' },
        { id: 4, name: '흑백', category: '필터', preview: 'bg-gray-500' },
        { id: 5, name: '세피아', category: '필터', preview: 'bg-yellow-600' },
    ];
    const getFileIcon = (type) => {
        switch (type) {
            case 'video': return 'ri-video-line';
            case 'audio': return 'ri-volume-up-line';
            case 'image': return 'ri-image-line';
            default: return 'ri-file-line';
        }
    };
    return (<div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col">
      <div className="border-b border-gray-700">
        <div className="flex">
          {tabs.map((tab) => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 p-3 flex flex-col items-center space-y-1 transition-colors cursor-pointer \${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}>
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={tab.icon}></i>
              </div>
              <span className="text-xs whitespace-nowrap">{tab.name}</span>
            </button>))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'media' && (<div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">미디어 파일</h3>
              <button className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer">
                <i className="ri-add-line"></i>
              </button>
            </div>
            <div className="space-y-2">
              {mediaFiles.map((file) => (<div key={file.id} className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors" draggable>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded">
                      <i className={`\${getFileIcon(file.type)} text-gray-300`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm whitespace-nowrap overflow-hidden text-ellipsis">{file.name}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        {file.duration && <span>{file.duration}</span>}
                        <span>{file.size}</span>
                      </div>
                    </div>
                  </div>
                </div>))}
            </div>
          </div>)}

        {activeTab === 'effects' && (<div className="space-y-3">
            <h3 className="text-white font-medium">비디오 효과</h3>
            <div className="grid grid-cols-2 gap-2">
              {effects.map((effect) => (<div key={effect.id} className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors" draggable>
                  <div className={`w-full h-16 \${effect.preview} rounded mb-2`}></div>
                  <p className="text-white text-sm">{effect.name}</p>
                  <p className="text-gray-400 text-xs">{effect.category}</p>
                </div>))}
            </div>
          </div>)}

        {activeTab === 'audio' && (<div className="space-y-3">
            <h3 className="text-white font-medium">오디오 라이브러리</h3>
            <div className="space-y-2">
              {['Upbeat Corporate', 'Cinematic Drama', 'Acoustic Guitar', 'Electronic Beats'].map((track, i) => (<div key={i} className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">{track}</p>
                      <p className="text-gray-400 text-xs">02:30</p>
                    </div>
                    <button className="w-8 h-8 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer">
                      <i className="ri-play-fill"></i>
                    </button>
                  </div>
                </div>))}
            </div>
          </div>)}

        {activeTab === 'text' && (<div className="space-y-3">
            <h3 className="text-white font-medium">텍스트 템플릿</h3>
            <div className="space-y-2">
              {['제목 템플릿', '자막 스타일', '로고 텍스트', '엔딩 크레딧'].map((template, i) => (<div key={i} className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                  <p className="text-white text-sm">{template}</p>
                  <div className="mt-2 h-8 bg-gray-700 rounded flex items-center px-2">
                    <span className="text-gray-300 text-xs">샘플 텍스트</span>
                  </div>
                </div>))}
            </div>
          </div>)}
      </div>
    </div>);
}
