import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, NavLink, Outlet, useOutletContext } from 'react-router-dom';
import './App.css';
import { useAuth } from './context/AuthContext';
import { api } from './api';

import Chat from './Chat';
import VideoStream from './VideoStream';
import Signup from './Signup';
import Login from './Login';
const Admin = React.lazy(() => import('./Admin'));

function App() {
  const { user, logout } = useAuth();

  return (
    <BrowserRouter>
      <div className="App">
        <div className='nav'>
          <Link to="/"><h4>내 스트리밍 앱</h4></Link>
          <div className="nav-links">
            {user ? (
              <>
                <span className="nav-user">{user.username}</span>
                {user.role > 1 && <Link to="/admin" className="nav-link">관리자</Link>}
                <Link to="/studio" className="nav-link">스튜디오로</Link>
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
              <Route path="/live/:id" element={<ViewLive />} />
              <Route path="/video/:id" element={<ViewVideo />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="*" element={<ErrorPage />} />

              <Route path="/admin" element={<Admin />} />

              <Route path="/channel/:channelid" element={<ChannelLayout />}>
                <Route index element={<ChannelHome />} />
                <Route path="videos" element={<ChannelVideos />} />
                <Route path="community" element={<ChannelCommunity />} />
                <Route path="about" element={<ChannelAbout />} />
              </Route>
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

function MainPage() {
  const [section, setSection] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get('/api/mainpage');
        setSection(Array.isArray(data) ? data : []);
      } catch (err) {
        setSection([]);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <h3>메인 페이지</h3>
      <div className="content-grid">
        {section && section.map((section, idx) => (
          <div key={idx} className="section-container">
              <h3>{section.title}</h3>
              <div className="item-list">
                {section.list && section.list.map((item, i) => (
                  <div key={i} className="item-card">
                    <Link to={item.link}>
                      {item.title}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function ViewLive() {
  const { id: channelid } = useParams();

  const videoRef = VideoStream(channelid);
  if(videoRef === null)
    return ErrorPage();

  return (
    <div className="video-page-layout" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <div className="video-player-container" style={{ flex: 1, padding: '20px' }}>
        <div className="player-wrapper" style={{ position: 'relative', backgroundColor: '#000' }}>
          <video ref={videoRef} controls autoPlay style={{ width: '100%', aspectRatio: '16/9' }} />
        </div>
        <h3>{channelid} 님의 라이브 <Link to={`/channel/${channelid}`}>채널로 이동</Link></h3>
      </div>
      <Chat channelid={channelid} />
    </div>
  );
}

function ChannelLayout() {
  const { channelid } = useParams();
  const [channelInfo, setChannelInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/channel/info/${channelid}`);
        setChannelInfo(data);
      } catch (err) {
        console.error("채널 정보 로드 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [channelid]);
  
  if (loading) return <div>채널 정보 로딩 중...</div>;

  return (
    <div className="channel-wrapper">
      <div className="channel-header">
        <h2>{channelInfo.username}</h2>
        <nav className="channel-tabs">
          <NavLink to={`/channel/${channelid}`} end>홈</NavLink>
          <NavLink to={`/channel/${channelid}/videos`}>동영상</NavLink>
          <NavLink to={`/channel/${channelid}/community`}>커뮤니티</NavLink>
          <NavLink to={`/channel/${channelid}/about`}>정보</NavLink>
        </nav>
      </div>
      <hr />
      
      <div className="channel-content">
        <Outlet context={{ channelid, channelInfo}} />
      </div>
    </div>
  );
}

function ChannelHome() {
  const { channelid, channelInfo } = useOutletContext();



  return (
    <div className="channel-home-container">
      {channelInfo.is_live === 1 ? (
        <div>
          <Link to={`/live/${channelid}`}>
            라이브 시청하기
          </Link>
        </div>
      ) : (
        <div className="offline-status">
          <p>현재는 방송 중이 아닙니다. 이전에 업로드된 영상을 확인해 보세요!</p>
        </div>
      )}
      <div style={{ marginTop: '20px' }}>
        <p>다시보기,클립,등등등등</p>
      </div>
    </div>
  );
}

function ChannelVideos() {
  const { channelid } = useParams();
  const [ videoData, setVideoData] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/channel/videos?channelid=${channelid}&page=${page}`);
        setVideoData(data);
      } catch (err) {
        console.error("비디오 로드 실패", err);
      }
    })();
  }, [channelid, page]);
  console.log(videoData);

  return (
    <div className="video-grid">
      {videoData.videos?(videoData.videos.map(video => (
        <div key={video.id} className="video-card">
          <Link to={`/video/${video.id}`}>
            <h4>{video.title}</h4>
            <p>{new Date(video.created_at).toLocaleDateString()}</p>
          </Link>
        </div>
      ))):[]}
      <div className="pagination">
        {Array.from({ length: videoData.totalPages }, (_, i) => (
          <Link key={i} to={`/${channelid}/${i+1}`}>
            {i+1}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ChannelCommunity() {
  return <div>채널 게시판(커뮤니티) 공간입니다.</div>;
}

function ChannelAbout() {
  const { channelInfo } = useOutletContext();

  return (
    <div className="about-section">
      <h3>채널 정보</h3>
      <p><strong>채널 이름:</strong> {channelInfo.channelname}</p>
      <p><strong>가입일:</strong> {new Date(channelInfo.created_at).toLocaleDateString()}</p>
    </div>
  );
}

function ViewVideo() {
  const { id } = useParams();
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/video/info?id=${id}`);
        setVideoInfo(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div>로딩 중...</div>;
  if (!videoInfo) return <div className="error">비디오를 찾을 수 없습니다. <Link to="/">돌아가기</Link></div>;

  return (
    <div className="video-page-layout" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <div className="video-player-container" style={{ flex: 1, padding: '20px' }}>
        <div className="player-wrapper" style={{ position: 'relative', backgroundColor: '#000', aspectRatio: '16/9' }}>
          <video 
            src={videoInfo.url} 
            controls 
            autoPlay 
            style={{ width: '100%', height: '100%' }} 
          />
        </div>
        <h3>{videoInfo.title}</h3>
        <p>채널: <Link to={`/channel/${videoInfo.channelid}`}>{videoInfo.channelid}</Link></p>
        <p>업로드 일자: {new Date(videoInfo.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}

function Studio(){
  const { user } = useAuth();
  const [streamKey, setStreamKey] = useState('');
  const [streamKeyMessage, setStreamKeyMessage] = useState({ type: '', text: '' });
  const [streamKeyLoading, setStreamKeyLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await api.post('/api/me/streamkey'); // TODO : 
        setStreamKey(data.stream_key || '');
      } catch {
        setStreamKey('');
      }
    })();
  }, [user]);

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

  return <div>
    {user && (
      <div className="stream-key-box">
        <h4>방송 설정 (스트림 키)</h4>
        <p className="stream-key-desc">OBS 등에서 아래 서버 주소와 스트림 키를 사용하세요. 스트림 키는 가입 시 자동 발급되며, 필요 시 재발급할 수 있습니다.</p>
        <div className="stream-key-info">
          <label>서버 주소</label>
          <code>{process.env.REACT_APP_RTMP_URL || 'rtmp://localhost/live' /* //TODO */}</code>
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
  </div>
}

function ErrorPage(){
  return <div>페이지를 찾을 수 없습니다. <Link to="/">홈으로</Link></div>;
}

export default App;
