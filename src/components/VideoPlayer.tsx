import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStream } from '../context/StreamContext';
import IFrameVideoPlayer from './IFrameVideoPlayer';

interface VideoPlayerProps {
  playlistVideo?: {
    id: number;
    nome: string;
    url: string;
    duracao?: number;
  };
  onVideoEnd?: () => void;
  className?: string;
  autoplay?: boolean;
  controls?: boolean;
  height?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  playlistVideo, 
  onVideoEnd, 
  className = "w-full",
  autoplay = false,
  controls = true,
  height = "h-96"
}) => {
  const { user } = useAuth();
  
  const [obsStreamActive, setObsStreamActive] = useState(false);
  const [obsStreamUrl, setObsStreamUrl] = useState<string>('');

  const userLogin = user?.usuario || (user?.email ? user.email.split('@')[0] : `user_${user?.id || 'usuario'}`);

  useEffect(() => {
    checkOBSStream();
  }, []);

  const checkOBSStream = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('/api/streaming/obs-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.obs_stream.is_live) {
          setObsStreamActive(true);
          setObsStreamUrl(`http://samhost.wcore.com.br:1935/samhost/${userLogin}_live/playlist.m3u8`);
        } else {
          setObsStreamActive(false);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar stream OBS:', error);
    }
  };
  
  // Determinar fonte de vídeo
  const getVideoSource = () => {
    if (playlistVideo?.url) {
      // Construir URL do player externo
      return buildExternalPlayerUrl(playlistVideo.url);
    } else if (streamData.isLive) {
      // Para stream ao vivo, usar iframe do player
      return `/api/players/iframe?stream=${userLogin}_live&aspectratio=16:9&player_type=1&autoplay=false`;
    } else if (obsStreamActive) {
      return `/api/players/iframe?stream=${userLogin}_live&aspectratio=16:9&player_type=1&autoplay=false`;
    }
    return '';
  };

  // Construir URL do player externo baseada no padrão fornecido
  const buildExternalPlayerUrl = (videoPath: string) => {
    if (!videoPath) return '';

    // Se já é uma URL do player, usar como está
    if (videoPath.includes('play.php') || videoPath.includes('/api/players/iframe')) {
      return videoPath;
    }

    // Extrair informações do caminho
    const cleanPath = videoPath.replace(/^\/+/, '').replace(/^(content\/|streaming\/)?/, '');
    const pathParts = cleanPath.split('/');
    
    if (pathParts.length >= 3) {
      const userLogin = pathParts[0];
      const folderName = pathParts[1];
      const fileName = pathParts[2];
      
      // Garantir que é MP4
      const finalFileName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');
      
      // Usar domínio correto baseado no ambiente
      const domain = window.location.hostname === 'localhost' ? 'stmv1.udicast.com' : 'samhost.wcore.com.br';
      
      // Construir URL do player externo
      return `https://${domain}:1443/play.php?login=${userLogin}&video=${folderName}/${finalFileName}`;
    }
    
    return '';
  };
  const getVideoTitle = () => {
    return playlistVideo?.nome || 
      (streamData.isLive ? streamData.title || 'Transmissão ao Vivo' : 
       obsStreamActive ? 'Transmissão OBS ao Vivo' : undefined);
  };

  const isLive = !playlistVideo && (streamData.isLive || obsStreamActive);

  return (
    <IFrameVideoPlayer
      src={getVideoSource()}
      title={getVideoTitle()}
      isLive={isLive}
      autoplay={autoplay}
      controls={controls}
      className={`${className} ${height}`}
      onError={(error) => {
        console.error('Erro no IFrame player:', error);
      }}
      onReady={() => {
        console.log('IFrame player pronto');
      }}
      onLoad={() => {
        console.log('IFrame player carregado');
        // Simular onVideoEnd após duração do vídeo se necessário
        if (playlistVideo?.duracao && onVideoEnd) {
          setTimeout(() => {
            onVideoEnd();
          }, (playlistVideo.duracao * 1000) + 5000); // +5s de margem
        }
      }}
      streamStats={isLive ? {
        viewers: Math.floor(Math.random() * 50) + 5,
        bitrate: 2500,
        uptime: '00:15:30',
        quality: '1080p',
        isRecording: false
      } : undefined}
    />
  );
};

export default VideoPlayer;