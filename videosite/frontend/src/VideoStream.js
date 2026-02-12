import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

function VideoStream(channelid){
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const initHls = async () => {
            if (!channelid || !videoRef.current) return;

            const video = videoRef.current;
            let hlsUrl = '';

            try {
                const { data } = await api.get(`/api/liveurl?channelid=${channelid}`);
                hlsUrl = data.url;
            } catch (err) {
                console.error("URL 로드 실패:", err);
                setError('방송 정보를 불러올 수 없습니다.');
                return;
            }

            if (!Hls.isSupported()) {
                if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = hlsUrl;
                } else {
                    setError('지원되지 않는 브라우저입니다.');
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
                video.play().catch(() => console.log("자동 재생 차단됨"));
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
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
                }
            });
        };

        initHls();

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [channelid]);
    
    if (error !== ''){
        console.log(error);
        return null;
    }
    return videoRef;
}

export default VideoStream;