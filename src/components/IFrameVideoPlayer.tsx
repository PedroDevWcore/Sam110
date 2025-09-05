import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, ExternalLink, AlertCircle, RotateCcw, Settings, Eye, Activity } from 'lucide-react';

interface IFrameVideoPlayerProps {
  src?: string;
  title?: string;
  isLive?: boolean;
  autoplay?: boolean;
  controls?: boolean;
  className?: string;
  aspectRatio?: '16:9' | '4:3' | '1:1' | 'auto';
  onError?: (error: any) => void;
  onReady?: () => void;
  onLoad?: () => void;
  streamStats?: {
    viewers?: number;
    bitrate?: number;
    uptime?: string;
    quality?: string;
    isRecording?: boolean;
  };
  showControls?: boolean;
  enableFullscreen?: boolean;
}

const IFrameVideoPlayer: React.FC<IFrameVideoPlayerProps> = ({
  src,
  title,
  isLive = false,
  autoplay = false,
  controls = true,
  className = '',
  aspectRatio = '16:9',
  onError,
  onReady,
  onLoad,
  streamStats,
  showControls = true,
  enableFullscreen = true
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Construir URL do iframe baseada no padrão fornecido
  const buildIFrameUrl = (videoPath: string) => {
    if (!videoPath) return '';

    // Se já é uma URL completa do player, usar como está
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

  // Configurar iframe quando src mudar
  useEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    const iframeUrl = buildIFrameUrl(src);
    console.log('🎥 IFrame Player - URL construída:', iframeUrl);

    if (!iframeUrl) {
      setError('Não foi possível construir URL do player');
      setLoading(false);
      return;
    }

    // Configurar iframe
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.src = iframeUrl;
    }
  }, [src]);

  // Event listeners do iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setLoading(false);
      setError(null);
      console.log('✅ IFrame carregado com sucesso');
      if (onLoad) onLoad();
      if (onReady) onReady();
    };

    const handleError = (e: Event) => {
      setLoading(false);
      const errorMsg = 'Erro ao carregar player externo';
      setError(errorMsg);
      console.error('❌ Erro no iframe:', e);
      if (onError) onError(e);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [onLoad, onReady, onError]);

  // Controles de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const openInNewTab = () => {
    if (src) {
      const iframeUrl = buildIFrameUrl(src);
      if (iframeUrl) {
        window.open(iframeUrl, '_blank');
      }
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    
    const iframe = iframeRef.current;
    if (iframe && src) {
      const iframeUrl = buildIFrameUrl(src);
      iframe.src = iframeUrl;
    }
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16:9': return 'aspect-video';
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      default: return 'aspect-video';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`iframe-video-player relative bg-black rounded-lg overflow-hidden ${getAspectRatioClass()} ${className}`}
    >
      {/* Indicador de transmissão ao vivo */}
      {isLive && (
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center space-x-2 text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>AO VIVO</span>
          </div>
        </div>
      )}

      {/* Estatísticas do stream */}
      {streamStats && showStats && (
        <div className="absolute top-4 right-4 z-20 bg-black bg-opacity-80 text-white p-3 rounded-lg text-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Eye className="h-3 w-3" />
              <span>{streamStats.viewers || 0} espectadores</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="h-3 w-3" />
              <span>{streamStats.bitrate || 0} kbps</span>
            </div>
            {streamStats.uptime && (
              <div className="flex items-center space-x-2">
                <Settings className="h-3 w-3" />
                <span>{streamStats.uptime}</span>
              </div>
            )}
            {streamStats.isRecording && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>Gravando</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-50">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="text-white text-sm">Carregando player...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-75">
          <div className="flex flex-col items-center space-y-4 text-white text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Erro no Player</h3>
              <p className="text-sm text-gray-300 mb-4">{error}</p>
              <div className="flex space-x-3">
                <button
                  onClick={retry}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Tentar Novamente</span>
                </button>
                <button
                  onClick={openInNewTab}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Abrir Externo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder quando não há vídeo */}
      {!src && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-white">
          <Play className="h-16 w-16 mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold mb-2">Player Externo</h3>
          <p className="text-gray-400 text-center max-w-md">
            Player que usa o sistema externo já configurado com iframe
          </p>
        </div>
      )}

      {/* IFrame do player */}
      {src && (
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          title={title || 'Video Player'}
        />
      )}

      {/* Controles customizados sobrepostos */}
      {showControls && src && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-2">
          {/* Estatísticas */}
          {streamStats && (
            <button
              onClick={() => setShowStats(!showStats)}
              className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-opacity"
              title="Estatísticas"
            >
              <Activity className="h-4 w-4" />
            </button>
          )}

          {/* Abrir em nova aba */}
          <button
            onClick={openInNewTab}
            className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-opacity"
            title="Abrir em nova aba"
          >
            <ExternalLink className="h-4 w-4" />
          </button>

          {/* Fullscreen */}
          {enableFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-opacity"
              title="Tela cheia"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Título do vídeo */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-none">
          <h3 className="text-white text-lg font-semibold truncate">{title}</h3>
          <p className="text-white text-sm opacity-80">Player Externo via iFrame</p>
        </div>
      )}
    </div>
  );
};

export default IFrameVideoPlayer;