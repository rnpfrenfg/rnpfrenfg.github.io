import React, { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './App.css';
import { useAuth } from './context/AuthContext';
import { API } from './api';

import Chat from './Chat';
import { useVideoStream } from './VideoStream';
import Signup from './Signup';
import Login from './Login';

const Admin = React.lazy(() => import('./Admin'));

function App() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <BrowserRouter>
      <div className="App">
        <div className="nav">
          <Link to="/"><h4>{t('nav.appTitle')}</h4></Link>
          <div className="nav-links">
            {user ? (
              <>
                <span className="nav-user">{user.username}</span>
                {user.role > 1 && <Link to="/admin" className="nav-link">{t('nav.admin')}</Link>}
                <Link to="/studio" className="nav-link">{t('nav.studio')}</Link>
                <button type="button" onClick={logout} className="nav-btn">{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">{t('nav.login')}</Link>
                <Link to="/signup" className="nav-link">{t('nav.signup')}</Link>
              </>
            )}
          </div>
        </div>

        <div className="main-layout">
          <div className="left-bar">{t('main.leftBar')}</div>
          <div className="main-container">
            <Routes>
              <Route path="/" element={<MainPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/live/:id" element={<ViewLive />} />
              <Route path="/video/:id" element={<ViewVideo />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/channel/:channelid" element={<ChannelLayout />}>
                <Route index element={<ChannelHome />} />
                <Route path="videos" element={<ChannelVideos />} />
                <Route path="community" element={<ChannelCommunity />} />
                <Route path="about" element={<ChannelAbout />} />
              </Route>
              <Route path="*" element={<ErrorPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

function MainPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState([]);

  useEffect(() => {
    (async () => {
      const result = await API.getMainPage();
      setSection(result.ok && Array.isArray(result.data) ? result.data : []);
    })();
  }, []);

  return (
    <div>
      <h3>{t('main.title')}</h3>
      <div className="content-grid">
        {section.map((item, idx) => (
          <div key={idx} className="section-container">
            <h3>{item.title}</h3>
            <div className="item-list">
              {(item.list || []).map((entry, i) => (
                <div key={i} className="item-card">
                  <Link to={entry.link}>{entry.title}</Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewLive() {
  const { t } = useTranslation();
  const { id: channelid } = useParams();
  const { videoRef, error } = useVideoStream(channelid);

  if (error) return <ErrorPage />;

  return (
    <div className="video-page-layout" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <div className="video-player-container" style={{ flex: 1, padding: '20px' }}>
        <div className="player-wrapper" style={{ position: 'relative', backgroundColor: '#000' }}>
          <video ref={videoRef} controls autoPlay style={{ width: '100%', aspectRatio: '16/9' }} />
        </div>
        <h3>
          {channelid} <Link to={`/channel/${channelid}`}>{t('channel.move')}</Link>
        </h3>
      </div>
      <Chat channelid={channelid} />
    </div>
  );
}

function ChannelLayout() {
  const { t } = useTranslation();
  const { channelid } = useParams();
  const [channelInfo, setChannelInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await API.getChannelInfo(channelid);
      if (result.ok) setChannelInfo(result.data);
      setLoading(false);
    })();
  }, [channelid]);

  if (loading) return <div>{t('channel.loading')}</div>;
  if (!channelInfo) return <div>{t('channel.notFound')}</div>;

  return (
    <div className="channel-wrapper">
      <div className="channel-header">
        <h2>{channelInfo.username}</h2>
        <nav className="channel-tabs">
          <NavLink to={`/channel/${channelid}`} end>{t('channel.home')}</NavLink>
          <NavLink to={`/channel/${channelid}/videos`}>{t('channel.videos')}</NavLink>
          <NavLink to={`/channel/${channelid}/community`}>{t('channel.community')}</NavLink>
          <NavLink to={`/channel/${channelid}/about`}>{t('channel.about')}</NavLink>
        </nav>
      </div>
      <hr />
      <div className="channel-content">
        <Outlet context={{ channelid, channelInfo }} />
      </div>
    </div>
  );
}

function ChannelHome() {
  const { t } = useTranslation();
  const { channelid, channelInfo } = useOutletContext();

  return (
    <div className="channel-home-container">
      {channelInfo.is_live === 1 ? (
        <div>
          <Link to={`/live/${channelid}`}>{t('channel.watchLive')}</Link>
        </div>
      ) : (
        <div className="offline-status">
          <p>{t('channel.offline')}</p>
        </div>
      )}
      <div style={{ marginTop: '20px' }}>
        <p>{t('channel.extra')}</p>
      </div>
    </div>
  );
}

function ChannelVideos() {
  const { channelid } = useParams();
  const [videoData, setVideoData] = useState({ videos: [], totalPages: 0 });
  const [page] = useState(1);

  useEffect(() => {
    (async () => {
      const result = await API.getChannelVideos(channelid, page);
      setVideoData(result.ok ? result.data : { videos: [], totalPages: 0 });
    })();
  }, [channelid, page]);

  return (
    <div className="video-grid">
      {(videoData.videos || []).map((video) => (
        <div key={video.id} className="video-card">
          <Link to={`/video/${video.id}`}>
            <h4>{video.title}</h4>
            <p>{new Date(video.created_at).toLocaleDateString()}</p>
          </Link>
        </div>
      ))}
      <div className="pagination">
        {Array.from({ length: videoData.totalPages || 0 }, (_, i) => (
          <Link key={i} to={`/${channelid}/${i + 1}`}>{i + 1}</Link>
        ))}
      </div>
    </div>
  );
}

function ChannelCommunity() {
  const { t } = useTranslation();
  return <div>{t('channel.communityPlaceholder')}</div>;
}

function ChannelAbout() {
  const { t } = useTranslation();
  const { channelInfo } = useOutletContext();

  return (
    <div className="about-section">
      <h3>{t('channel.infoTitle')}</h3>
      <p><strong>{t('channel.name')}:</strong> {channelInfo.channelname}</p>
      <p><strong>{t('channel.joinedAt')}:</strong> {new Date(channelInfo.created_at).toLocaleDateString()}</p>
    </div>
  );
}

function ViewVideo() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await API.getVideoInfo(id);
      setVideoInfo(result.ok ? result.data : null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div>{t('common.loading')}</div>;
  if (!videoInfo) return <div className="error">{t('video.notFound')} <Link to="/">{t('common.goHome')}</Link></div>;

  return (
    <div className="video-page-layout" style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <div className="video-player-container" style={{ flex: 1, padding: '20px' }}>
        <div className="player-wrapper" style={{ position: 'relative', backgroundColor: '#000', aspectRatio: '16/9' }}>
          <video src={videoInfo.url} controls autoPlay style={{ width: '100%', height: '100%' }} />
        </div>
        <h3>{videoInfo.title}</h3>
        <p>{t('video.channel')}: <Link to={`/channel/${videoInfo.channelid}`}>{videoInfo.channelid}</Link></p>
        <p>{t('video.uploadedAt')}: {new Date(videoInfo.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}

function Studio() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [streamKey, setStreamKey] = useState('');
  const [streamKeyMessage, setStreamKeyMessage] = useState({ type: '', text: '' });
  const [streamKeyLoading, setStreamKeyLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const result = await API.getMyStreamKey();
      setStreamKey(result.ok ? result.data?.stream_key || '' : '');
    })();
  }, [user]);

  const handleRegenerateStreamKey = async () => {
    setStreamKeyMessage({ type: '', text: '' });
    setStreamKeyLoading(true);
    const result = await API.regenerateStreamKey();
    if (result.ok) {
      const data = result.data || {};
      setStreamKey(data.stream_key || '');
      setStreamKeyMessage({ type: 'success', text: data.message || t('studio.regenerateSuccess') });
    } else {
      setStreamKeyMessage({ type: 'error', text: result.error || t('studio.regenerateFail') });
    }
    setStreamKeyLoading(false);
  };

  return (
    <div>
      {user && (
        <div className="stream-key-box">
          <h4>{t('studio.title')}</h4>
          <p className="stream-key-desc">{t('studio.desc')}</p>
          <div className="stream-key-info">
            <label>{t('studio.serverUrl')}</label>
            <code>{process.env.REACT_APP_RTMP_URL || 'rtmp://localhost/live'}</code>
          </div>
          <div className="stream-key-info">
            <label>{t('studio.streamKey')}</label>
            <code className="stream-key-value">{streamKey || t('studio.loadingKey')}</code>
          </div>
          {streamKeyMessage.text && <div className={`message message-${streamKeyMessage.type}`}>{streamKeyMessage.text}</div>}
          <button type="button" className="stream-key-btn" onClick={handleRegenerateStreamKey} disabled={streamKeyLoading}>
            {streamKeyLoading ? t('studio.processing') : t('studio.regenerate')}
          </button>
          {streamKey && <p className="stream-key-current">{t('studio.currentHint')}</p>}
        </div>
      )}
    </div>
  );
}

function ErrorPage() {
  const { t } = useTranslation();
  return <div>{t('errorPage.notFound')} <Link to="/">{t('common.goHome')}</Link></div>;
}

export default App;
