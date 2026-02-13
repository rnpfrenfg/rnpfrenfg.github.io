import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from './api';

export function useVideoStream(channelid) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const initHls = async () => {
      if (!channelid || !videoRef.current) return;

      const video = videoRef.current;
      const result = await API.getLiveUrl(channelid);
      if (!result.ok || !result.data?.url) {
        setError(result.error || t('errors.LIVE_INFO_FETCH_FAILED'));
        return;
      }

      const hlsUrl = result.data.url;

      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = hlsUrl;
        } else {
          setError(t('errors.LIVE_BROWSER_NOT_SUPPORTED'));
        }
        return;
      }

      const hls = new Hls({
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 10,
        maxBufferLength: 30,
        enableWorker: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          console.warn(t('errors.LIVE_AUTOPLAY_BLOCKED'));
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      });
    };

    setError('');
    initHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channelid, t]);

  return { videoRef, error };
}
