'use client';

import Toolbar from '../components/VideoEditor/Toolbar';
import Preview from '../components/VideoEditor/Preview';
import Timeline from '../components/VideoEditor/Timeline';
import Sidebar from '../components/VideoEditor/Sidebar';

export default function Home() {
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <Toolbar />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <Preview />
          <Timeline />
        </div>
      </div>
    </div>
  );
}