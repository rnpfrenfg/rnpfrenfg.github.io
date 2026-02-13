import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

function VideoStream(channelid){
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const [error, setError] = useState('');

    const initHls = async () => {

    };

    initHls();
    
    if (error !== ''){
        console.log(error);
        return null;
    }
    return videoRef;
}

export default VideoStream;