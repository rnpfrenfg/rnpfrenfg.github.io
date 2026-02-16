import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import StatusMessage from '../components/StatusMessage';
import VideoCard from '../components/VideoCard';

function useChannelVideos(channelid, initialPage = 1) {
  const [videoData, setVideoData] = useState({ videos: [], totalPages: 0 });
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await API.getChannelVideos(channelid, page);
      if (cancelled) return;
      if (result.ok) {
        setVideoData(result.data || { videos: [], totalPages: 0 });
        setErrorText('');
      } else {
        setVideoData({ videos: [], totalPages: 0 });
        setErrorText(result.error || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelid, page]);

  return { videoData, page, setPage, loading, errorText };
}

function ChannelLayout() {
  const { t } = useTranslation();
  const { channelid } = useParams();
  const [channelInfo, setChannelInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await API.getChannelInfo(channelid);
      if (cancelled) return;
      if (result.ok) {
        setChannelInfo(result.data);
      } else {
        setChannelInfo(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [channelid]);

  if (loading) return <StatusMessage text={t('channel.loading')} />;
  if (!channelInfo) return <StatusMessage type="error" text={t('channel.notFound')} />;

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
  const { t } = useTranslation();
  const { channelid } = useParams();
  const { videoData, page, setPage, loading, errorText } = useChannelVideos(channelid, 1);

  if (loading) return <StatusMessage text={t('common.loading')} />;
  if (errorText) return <StatusMessage type="error" text={errorText} />;

  return (
    <div>
      <div className="video-grid ch-videoGrid">
        {(videoData.videos || []).map((video) => (
          <VideoCard key={video.id} video={video} />
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

export { ChannelLayout, ChannelHome, ChannelVideos, ChannelCommunity, ChannelAbout };
