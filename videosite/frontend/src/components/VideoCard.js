import { Link } from 'react-router-dom';
import { API } from '../api';

function VideoCard({ video }) {
  if (!video) return null;
  return (
    <div className="video-card ch-videoCard">
      <Link to={`/video/${video.id}`} className="video-card-link ch-videoLink">
        <div className="thumb-frame media-thumbFrame" aria-hidden="true">
          <img
            className="thumb-img media-thumbImg"
            src={API.getVideoThumbnailUrl(`/thumbnail/${video.id}`)}
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
  );
}

export default VideoCard;
