import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Chat from '../components/Chat';
import { useVideoStream } from '../VideoStream';
import ErrorPage from './ErrorPage';

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

export default ViewLive;
