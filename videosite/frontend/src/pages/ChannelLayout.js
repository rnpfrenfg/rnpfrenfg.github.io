import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { useAuth } from '../context/AuthContext';
import StatusMessage from '../components/StatusMessage';
import VideoCard from '../components/VideoCard';

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
  const [videos, setVideos] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState('');
  const sentinelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setVideos([]);
    setCursor(0);
    setHasMore(true);
    setLoading(true);
    setLoadingMore(false);
    setErrorText('');

    (async () => {
      const result = await API.getChannelVideos(channelid, 0);
      if (cancelled) return;

      if (!result.ok) {
        setVideos([]);
        setHasMore(false);
        setErrorText(result.error || '');
        setLoading(false);
        return;
      }

      const initial = Array.isArray(result.data?.videos) ? result.data.videos : [];
      setVideos(initial);
      setCursor(Number(result.data?.lastid) || 0);
      setHasMore(Boolean(result.data?.hasMore));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [channelid]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !channelid) return;

    setLoadingMore(true);
    const result = await API.getChannelVideos(channelid, cursor);
    if (!result.ok) {
      setErrorText(result.error || '');
      setLoadingMore(false);
      return;
    }

    const nextVideos = Array.isArray(result.data?.videos) ? result.data.videos : [];
    setVideos((prev) => {
      const existing = new Set(prev.map((v) => v?.id));
      const merged = prev.slice();
      for (const v of nextVideos) {
        if (!v) continue;
        if (existing.has(v.id)) continue;
        existing.add(v.id);
        merged.push(v);
      }
      return merged;
    });
    setCursor(Number(result.data?.lastid) || cursor);
    setHasMore(Boolean(result.data?.hasMore));
    setLoadingMore(false);
  }, [channelid, cursor, hasMore, loading, loadingMore]);

  useEffect(() => {
    if (loading) return () => {};
    if (!hasMore) return () => {};
    const el = sentinelRef.current;
    if (!el) return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: null, rootMargin: '400px 0px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading]);

  if (loading) return <StatusMessage text={t('common.loading')} />;
  if (errorText && videos.length === 0) return <StatusMessage type="error" text={errorText} />;

  return (
    <div>
      <div className="video-grid ch-videoGrid">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
      {errorText && videos.length > 0 && <StatusMessage type="error" text={errorText} />}
      {videos.length === 0 && <StatusMessage text={t('channel.noVideos')} />}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && <StatusMessage text={t('common.loading')} />}
    </div>
  );
}

function ChannelCommunity() {
  const { t } = useTranslation();
  const { channelid } = useOutletContext();
  const { user } = useAuth();
  const isOwner = user?.id != null && String(user.id) === String(channelid);
  const [refreshKey, setRefreshKey] = useState(0);
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState('');
  const sentinelRef = useRef(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState(false);
  const [writeErrorText, setWriteErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPosts([]);
    setCursor(0);
    setHasMore(true);
    setLoading(true);
    setLoadingMore(false);
    setErrorText('');

    (async () => {
      const result = await API.getChannelPosts(channelid, 0);
      if (cancelled) return;

      if (!result.ok) {
        setPosts([]);
        setHasMore(false);
        setErrorText(result.error || '');
        setLoading(false);
        return;
      }

      const initial = Array.isArray(result.data?.posts) ? result.data.posts : [];
      setPosts(initial);
      setCursor(Number(result.data?.lastid) || 0);
      setHasMore(Boolean(result.data?.hasMore));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [channelid, refreshKey]);

  const onSubmitPost = useCallback(async () => {
    if (!isOwner || writing) return;
    const text = draft.trim();
    if (!text) return;

    setWriting(true);
    setWriteErrorText('');

    const result = await API.writeChannelPost(channelid, text);
    if (!result.ok) {
      setWriteErrorText(result.error || '');
      setWriting(false);
      return;
    }

    setDraft('');
    setComposerOpen(false);
    setWriting(false);
    setRefreshKey((k) => k + 1);
  }, [channelid, draft, isOwner, writing]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !channelid) return;

    setLoadingMore(true);
    const result = await API.getChannelPosts(channelid, cursor);
    if (!result.ok) {
      setErrorText(result.error || '');
      setLoadingMore(false);
      return;
    }

    const nextPosts = Array.isArray(result.data?.posts) ? result.data.posts : [];
    setPosts((prev) => {
      const existing = new Set(prev.map((p) => p?.id));
      const merged = prev.slice();
      for (const p of nextPosts) {
        if (!p) continue;
        if (existing.has(p.id)) continue;
        existing.add(p.id);
        merged.push(p);
      }
      return merged;
    });
    setCursor(Number(result.data?.lastid) || cursor);
    setHasMore(Boolean(result.data?.hasMore));
    setLoadingMore(false);
  }, [channelid, cursor, hasMore, loading, loadingMore]);

  useEffect(() => {
    if (loading) return () => {};
    if (!hasMore) return () => {};
    const el = sentinelRef.current;
    if (!el) return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: null, rootMargin: '400px 0px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading]);

  if (loading) return <StatusMessage text={t('common.loading')} />;
  if (errorText && posts.length === 0) return <StatusMessage type="error" text={errorText} />;

  return (
    <div className="ch-community">
      {isOwner && (
        <div className="ch-communityComposer">
          <button type="button" onClick={() => { setComposerOpen((v) => !v); setWriteErrorText(''); }}>
            {composerOpen ? '닫기' : '글쓰기'}
          </button>
          {composerOpen && (
            <div className="ch-communityComposerBox">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="ch-communityComposerTextarea"
                placeholder="무슨 소식을 공유할까요?"
                disabled={writing}
              />
              <div className="ch-communityComposerActions">
                <button type="button" onClick={onSubmitPost} disabled={writing || !draft.trim()}>
                  {writing ? t('common.loading') : '작성'}
                </button>
              </div>
              {writeErrorText && <StatusMessage type="error" text={writeErrorText} />}
            </div>
          )}
        </div>
      )}
      {posts.length === 0 ? (
        <StatusMessage text={t('channel.noPosts')} />
      ) : (
        <div className="ch-communityPosts">
          {posts.map((post) => (
            <div key={post.id} className="ch-communityPost">
              <div className="ch-communityPostMeta">
                <span className="ch-communityPostDate">
                  {post.created_at ? new Date(post.created_at).toLocaleString() : ''}
                </span>
              </div>
              <div className="ch-communityPostBody">{post.post ?? ''}</div>
            </div>
          ))}
        </div>
      )}
      {errorText && posts.length > 0 && <StatusMessage type="error" text={errorText} />}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && <StatusMessage text={t('common.loading')} />}
    </div>
  );
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
