import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import { useState } from 'react';

const MAINPAGE = 'MAIN'
const VIEWVIDEO = 'VIDEO'

const api = axios.create({
  // 실제 배포 시에는 환경 변수(.env)를 사용합니다.
  baseURL: 'import.meta.env.VITE_API_BASE_URL', 
  timeout: 5000, // 5초 이상 응답 없으면 취소
});

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <div className='nav'>
          <Link to="/"><h4>내 스트리밍 앱</h4></Link>
        </div>

        <div className="main-layout">
          <div className="left-bar">팔로잉 채널 목록</div>

          <div className="main-container">
            <Routes>
              <Route path="/" element={<MainPage />} />
              <Route path="/video/:id" element={<ViewVideo />} />
              <Route path="*" element={<ErrorPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

function MainPage() {
  const videoList = [
    { id: '101', title: '리액트 기초 강의' },
    { id: '102', title: '자바스크립트 마스터' }
  ];

  return (
    <div>
      <h3>메인 페이지</h3>
      {videoList.map(video => (
        <div key={video.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
          <h4>{video.title}</h4>
          {/* 주소 뒤에 ID를 붙여서 이동합니다 */}
          <Link to={`/video/${video.id}`}>시청하기</Link>
        </div>
      ))}
    </div>
  );
}

function ViewVideo() {
  let { id } = useParams();

  return (
    <div>
      <h3>비디오 시청 중입니다!</h3>
      <p style={{ color: 'blue', fontWeight: 'bold' }}>현재 영상 ID: {id}</p>
      <Link to="/">목록으로 돌아가기</Link>
    </div>
  );
}

function ErrorPage(){
  return <div>페이지를 찾을 수 없습니다. <Link to="/">홈으로</Link></div>;
}

export default App;
