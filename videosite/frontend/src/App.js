import React, { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './App.css';
import { useAuth } from './context/AuthContext';
import { API } from './api';

import Chat, { VodChat } from './Chat';
import { useVideoStream } from './VideoStream';
import Signup from './Signup';
import Login from './Login';

const Admin = React.lazy(() => import('./Admin'));

function getVideoIdFromLink(link) {
  if (typeof link !== 'string') return null;
  const match = link.match(/^\/video\/(\d+)(?:$|[/?#])/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function App() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <BrowserRouter>
      <div className="app-root">
        <div className="app-layout">
          <div className="app-nav">
            <Link to="/"><h4>{t('nav.appTitle')}</h4></Link>
            <div className="app-navLinks">
              {user ? (
                <>
                  <span className="app-navUser">{user.username}</span>
                  {user.role > 1 && <Link to="/admin" className="app-navLink">{t('nav.admin')}</Link>}
                  <Link to="/studio" className="app-navLink">{t('nav.studio')}</Link>
                  <button type="button" onClick={logout} className="app-navBtn">{t('nav.logout')}</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="app-navLink">{t('nav.login')}</Link>
                  <Link to="/signup" className="app-navLink">{t('nav.signup')}</Link>
                </>
              )}
            </div>
          </div>
          <div className="app-sidebar">{t('main.leftBar')}</div>
          <div className="app-main">
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
  const [section, setSection] = useState([]);

  useEffect(() => {
    (async () => {
      const result = await API.getMainPage();

      const raw = (result.ok && Array.isArray(result.data)) ? result.data : [];
      setSection(raw);
    })();
  }, []);

  return (
    <div className="mp-page">
      <div className="mp-sections">
        {section.map((item, idx) => (
          <div key={idx} className="mp-section">
            <h3 className="mp-sectionTitle">{item.title}</h3>
            <div className="item-list mp-itemList">
              {(item.list || []).map((entry, i) => (
                <div key={i} className="item-card mp-itemCard">
                  <Link to={entry.link} className="item-link mp-itemLink">
                    <div className="thumb-frame media-thumbFrame" aria-hidden="true">
                      {(() => {
                        const thumbnail = entry.thumbnail ?? getVideoIdFromLink(entry.link);
                        if (!thumbnail) return <div className="thumb-placeholder media-thumbPlaceholder">LIVE</div>;
                        return (
                          <img
                            className="thumb-img media-thumbImg"
                            src={API.getVideoThumbnailUrl(entry.thumbnail)}
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        );
                      })()}
                    </div>
                    <div className="item-meta mp-itemMeta">
                      <div className="item-title mp-itemTitle">{entry.title}</div>
                    </div>
                  </Link>
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
    <div className="vp-layout">
      <div className="vp-player">
        <div className="vp-wrapper">
          <video ref={videoRef} controls autoPlay />
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
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const result = await API.getChannelVideos(channelid, page);
      setVideoData(result.ok ? result.data : { videos: [], totalPages: 0 });
    })();
  }, [channelid, page]);

  return (
    <div>
      <div className="video-grid ch-videoGrid">
        {(videoData.videos || []).map((video) => (
          <div key={video.id} className="video-card ch-videoCard">
            <Link to={`/video/${video.id}`} className="video-card-link ch-videoLink">
              <div className="thumb-frame media-thumbFrame" aria-hidden="true">
                <img
                  className="thumb-img media-thumbImg"
                  src={API.getVideoThumbnailUrl(`/thumbnail/${video.id}`)} // TODO 실제 링크로 변경
                  alt={video.title || ''}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div className="item-meta ch-videoMeta">
                <h4 className="video-title ch-videoTitle">{video.title}</h4>
                <p className="video-date ch-videoDate">{new Date(video.created_at).toLocaleDateString()}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
      <div className="pagination ch-pagination">
        {Array.from({ length: videoData.totalPages || 0 }, (_, i) => {
          const pageNumber = i + 1;
          return (
            <button
              key={pageNumber}
              type="button"
              className={`ch-pageButton ${page === pageNumber ? "active" : ""}`}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          );
        })}
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
  const videoRef = React.useRef(null);

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
    <div className="vp-layout">
      <div className="vp-player">
        <div className="vp-wrapper">
          <video ref={videoRef} src={videoInfo.url} controls autoPlay />
        </div>
        <h3>{videoInfo.title}</h3>
        <p>{t('video.channel')}: <Link to={`/channel/${videoInfo.channelid}`}>{videoInfo.channelid}</Link></p>
        <p>{t('video.uploadedAt')}: {new Date(videoInfo.created_at).toLocaleString()}</p>
      </div>
      <VodChat
        videoId={Number(id)}
        getCurrentTime={() => videoRef.current?.currentTime ?? null}
      />
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
