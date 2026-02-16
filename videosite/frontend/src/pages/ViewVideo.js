import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { VodChat } from '../components/Chat';
import StatusMessage from '../components/StatusMessage';

function ViewVideo() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const videoRef = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await API.getVideoInfo(id);
      if (cancelled) return;
      if (result.ok) {
        setVideoInfo(result.data || null);
        setErrorText('');
      } else {
        setVideoInfo(null);
        setErrorText(result.error || t('video.notFound'));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, t]);

  if (loading) return <StatusMessage text={t('common.loading')} />;
  if (!videoInfo) return <StatusMessage type="error" text={errorText || t('video.notFound')} />;

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

export default ViewVideo;
