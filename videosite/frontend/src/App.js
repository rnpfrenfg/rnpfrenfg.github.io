import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import './App.css';
import Hls from 'hls.js';
import { useAuth } from './context/AuthContext';
import { api } from './api';

import Chat from './Chat';
import Signup from './Signup';
import Login from './Login';
import Admin from './Admin';

function App() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <BrowserRouter>
      <div className="App">
        <div className='nav'>
          <Link to="/"><h4>내 스트리밍 앱</h4></Link>
          <div className="nav-links">
            {user ? (
              <>
                <span className="nav-user">{user.username}</span>
                {isAdmin && <Link to="/admin" className="nav-link">관리자</Link>}
                <button type="button" onClick={logout} className="nav-btn">로그아웃</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">로그인</Link>
                <Link to="/signup" className="nav-link">회원가입</Link>
              </>
            )}
          </div>
        </div>

        <div className="main-layout">
          <div className="left-bar">팔로잉 채널 목록</div>

          <div className="main-container">
            <Routes>
              <Route path="/" element={<MainPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/video/:id" element={<ViewVideo />} />
              <Route path="*" element={<ErrorPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

const RTMP_SERVER = process.env.REACT_APP_RTMP_URL || 'rtmp://localhost/live';

function MainPage() {
  const { user } = useAuth();
  const [streamKey, setStreamKey] = useState('');
  const [streamKeyMessage, setStreamKeyMessage] = useState({ type: '', text: '' });
  const [streamKeyLoading, setStreamKeyLoading] = useState(false);
  const [liveList, setLiveList] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await api.get('/api/me/stream-key');
        setStreamKey(data.stream_key || '');
      } catch {
        setStreamKey('');
      }
    })();
  }, [user]);

  useEffect(() => {
    let t;
    const fetchLive = async () => {
      try {
        const { data } = await api.get('/api/live');
        setLiveList(Array.isArray(data) ? data : []);
      } catch {
        setLiveList([]);
      }
    };
    fetchLive();
    t = setInterval(fetchLive, 5000);
    return () => clearInterval(t);
  }, []);

  const handleRegenerateStreamKey = async () => {
    setStreamKeyMessage({ type: '', text: '' });
    setStreamKeyLoading(true);
    try {
      const { data } = await api.post('/api/me/stream-key/regenerate');
      setStreamKey(data.stream_key || '');
      setStreamKeyMessage({ type: 'success', text: data.message || '새 스트림 키가 발급되었습니다.' });
    } catch (err) {
      const text = err.response?.data?.error || '재발급에 실패했습니다.';
      setStreamKeyMessage({ type: 'error', text });
    } finally {
      setStreamKeyLoading(false);
    }
  };

  const videoList = [
    { id: '101', title: '리액트 기초 강의' },
    { id: '102', title: '자바스크립트 마스터' }
  ];

  return (
    <div>
      <h3>메인 페이지</h3>

      {user && (
        <div className="stream-key-box">
          <h4>방송 설정 (스트림 키)</h4>
          <p className="stream-key-desc">OBS 등에서 아래 서버 주소와 스트림 키를 사용하세요. 스트림 키는 가입 시 자동 발급되며, 필요 시 재발급할 수 있습니다.</p>
          <div className="stream-key-info">
            <label>서버 주소</label>
            <code>{RTMP_SERVER}</code>
          </div>
          <div className="stream-key-info">
            <label>스트림 키</label>
            <code className="stream-key-value">{streamKey || '불러오는 중...'}</code>
          </div>
          {streamKeyMessage.text && (
            <div className={`message message-${streamKeyMessage.type}`}>{streamKeyMessage.text}</div>
          )}
          <button type="button" className="stream-key-btn" onClick={handleRegenerateStreamKey} disabled={streamKeyLoading}>
            {streamKeyLoading ? '처리 중...' : '스트림 키 재발급'}
          </button>
          {streamKey && (
            <p className="stream-key-current">위 키로 방송을 시작하면 자동으로 방송 중으로 표시됩니다.</p>
          )}
        </div>
      )}

      {liveList.length > 0 && (
        <div className="live-list">
          <h4>지금 라이브</h4>
          {liveList.map((u) => (
            <div key={u.username} className="live-item">
              <span className="live-username">{u.username}</span>
              <Link to={`/video/${u.username}`}>시청하기</Link>
            </div>
          ))}
        </div>
      )}

      <h4 style={{ marginTop: 24 }}>추천 영상</h4>
      {videoList.map(video => (
        <div key={video.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
          <h4>{video.title}</h4>
          <Link to={`/video/${video.id}`}>시청하기</Link>
        </div>
      ))}
    </div>
  );
}

function ViewVideo() {
const { id: username } = useParams();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username || !videoRef.current) return;

    const video = videoRef.current;
    const hlsUrl = `http://localhost:8080/live/${username}/index.m3u8`;

    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
      }
    }
    const hls = new Hls({
      liveSyncDurationCount: 1,
      liveMaxLatencyDurationCount: 10,
      maxBufferLength: 30,
      enableWorker: true,
      manifestLoadingMaxRetry: 10,
      levelLoadingMaxRetry: 10,
    });

    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hlsRef.current = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {
        console.log("자동 재생이 차단되었습니다. 사용자 상호작용이 필요합니다.");
      });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log("네트워크 오류 발생, 재시도 중...");
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("미디어 오류 발생, 복구 중...");
            hls.recoverMediaError();
            break;
          default:
            setError('방송을 불러올 수 없습니다.');
            hls.destroy();
            break;
        }
      }
    });

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }
  , [username]);

  if (error) return <div className="error">{error} <Link to="/">돌아가기</Link></div>;

  return (
    <div className="video-page-layout" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <div className="video-player-container" style={{ flex: 1, padding: '20px' }}>
        <div className="player-wrapper" style={{ position: 'relative', backgroundColor: '#000' }}>
          <video ref={videoRef} controls autoPlay muted style={{ width: '100%', aspectRatio: '16/9' }} />
        </div>
        <h3>{username} 님의 라이브</h3>
      </div>
      <Chat channelOwner={username} />
    </div>
  );
}

function ErrorPage(){
  return <div>페이지를 찾을 수 없습니다. <Link to="/">홈으로</Link></div>;
}

export default App;
