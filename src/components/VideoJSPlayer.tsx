import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, AlertCircle, RotateCcw, ExternalLink, Activity, Eye, Clock } from 'lucide-react';

interface VideoJSPlayerProps {
  src?: string;
  title?: string;
  isLive?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
  streamStats?: {
    viewers?: number;
    bitrate?: number;
    uptime?: string;
    quality?: string;
    isRecording?: boolean;
  };
}

declare global {
  interface Window {
    videojs: any;
  }
}

const VideoJSPlayer: React.FC<VideoJSPlayerProps> = ({
  src,
  title,
  isLive = false,
  autoplay = false,
  muted = false,
  controls = true,
  className = '',
  onReady,
  onPlay,
  onPause,
  onEnded,
  onError,
  streamStats
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isDisposed, setIsDisposed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Cleanup function
  const cleanupPlayer = () => {
    if (playerRef.current && !isDisposed) {
      try {
        console.log('🧹 Limpando Video.js player...');
        setIsDisposed(true);
        
        // Remove all event listeners first
        playerRef.current.off();
        
        // Pause and reset
        if (typeof playerRef.current.pause === 'function') {
          playerRef.current.pause();
        }
        
        // Dispose of the player
        if (typeof playerRef.current.dispose === 'function') {
          playerRef.current.dispose();
        }
        
        playerRef.current = null;
        setIsPlayerReady(false);
        console.log('✅ Video.js player limpo com sucesso');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar Video.js player:', error);
        // Force cleanup
        playerRef.current = null;
        setIsPlayerReady(false);
      }
    }
  };

  // Carregar Video.js dinamicamente
  useEffect(() => {
    let mounted = true;
    
    const loadVideoJS = async () => {
      // Verificar se Video.js já está carregado
      if (window.videojs) {
        if (mounted) {
          initializePlayer();
        }
        return;
      }

      try {
        // Carregar CSS do Video.js
        if (!document.querySelector('link[href*="video-js.css"]')) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://vjs.zencdn.net/8.6.1/video-js.css';
          document.head.appendChild(cssLink);
        }

        // Carregar JavaScript do Video.js
        if (!document.querySelector('script[src*="video.min.js"]')) {
          const script = document.createElement('script');
          script.src = 'https://vjs.zencdn.net/8.6.1/video.min.js';
          script.onload = () => {
            // Carregar plugin HLS
            if (!document.querySelector('script[src*="videojs-contrib-hls"]')) {
              const hlsScript = document.createElement('script');
              hlsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/videojs-contrib-hls/5.15.0/videojs-contrib-hls.min.js';
              hlsScript.onload = () => {
                if (mounted) {
                  initializePlayer();
                }
              };
              hlsScript.onerror = () => {
                if (mounted) {
                  setError('Erro ao carregar plugin HLS');
                  setLoading(false);
                }
              };
              document.head.appendChild(hlsScript);
            } else {
              if (mounted) {
                initializePlayer();
              }
            }
          };
          script.onerror = () => {
            if (mounted) {
              setError('Erro ao carregar Video.js');
              setLoading(false);
            }
          };
          document.head.appendChild(script);
        } else {
          if (mounted) {
            initializePlayer();
          }
        }
      } catch (error) {
        console.error('Erro ao carregar Video.js:', error);
        if (mounted) {
          setError('Erro ao carregar player');
          setLoading(false);
        }
      }
    };

    const initializePlayer = () => {
      if (!videoRef.current || !window.videojs || isDisposed || !mounted) return;

      try {
        setLoading(true);
        setError(null);
        setIsDisposed(false);

        // Ensure the video element is properly attached to DOM
        if (!videoRef.current.parentNode) {
          console.warn('⚠️ Video element não está no DOM, aguardando...');
          setTimeout(() => {
            if (mounted && !isDisposed) {
              initializePlayer();
            }
          }, 100);
          return;
        }

        console.log('🎥 Inicializando Video.js player...');

        const player = window.videojs(videoRef.current, {
          controls: controls,
          responsive: true,
          fluid: true,
          playbackRates: [0.5, 1, 1.25, 1.5, 2],
          html5: {
            hls: {
              overrideNative: true,
              enableLowInitialPlaylist: isLive,
              smoothQualityChange: true,
              handlePartialData: true
            },
            vhs: {
              overrideNative: true
            }
          },
          liveui: isLive,
          liveTracker: isLive ? {
            trackingThreshold: 20,
            liveTolerance: 15
          } : false,
          inactivityTimeout: 0, // Disable inactivity timeout
          userActions: {
            hotkeys: true
          }
        });

        // Store player reference
        playerRef.current = player;

        // Event listeners with error handling
        player.ready(() => {
          if (!mounted || isDisposed) return;
          
          console.log('✅ Video.js player pronto');
          setIsPlayerReady(true);
          setLoading(false);
          setRetryCount(0);
          
          if (onReady) {
            try {
              onReady();
            } catch (callbackError) {
              console.warn('Erro no callback onReady:', callbackError);
            }
          }
          
          // Configurar fonte inicial se disponível
          if (src && mounted && !isDisposed) {
            updatePlayerSource();
          }
        });

        player.on('play', () => {
          if (!mounted || isDisposed) return;
          console.log('▶️ Video.js play');
          if (onPlay) {
            try {
              onPlay();
            } catch (callbackError) {
              console.warn('Erro no callback onPlay:', callbackError);
            }
          }
        });

        player.on('pause', () => {
          if (!mounted || isDisposed) return;
          console.log('⏸️ Video.js pause');
          if (onPause) {
            try {
              onPause();
            } catch (callbackError) {
              console.warn('Erro no callback onPause:', callbackError);
            }
          }
        });

        player.on('ended', () => {
          if (!mounted || isDisposed) return;
          console.log('🔚 Video.js ended');
          if (onEnded) {
            try {
              onEnded();
            } catch (callbackError) {
              console.warn('Erro no callback onEnded:', callbackError);
            }
          }
        });

        player.on('error', (e: any) => {
          if (!mounted || isDisposed) return;
          
          console.error('❌ Video.js error:', e);
          const errorObj = player.error();
          
          let errorMessage = 'Erro ao carregar vídeo';
          if (errorObj) {
            switch (errorObj.code) {
              case 1:
                errorMessage = 'Reprodução abortada';
                break;
              case 2:
                errorMessage = 'Erro de rede';
                break;
              case 3:
                errorMessage = 'Erro de decodificação';
                break;
              case 4:
                errorMessage = 'Formato não suportado';
                break;
              default:
                errorMessage = errorObj.message || 'Erro desconhecido';
            }
          }
          
          setError(errorMessage);
          setLoading(false);
          
          if (onError) {
            try {
              onError(e);
            } catch (callbackError) {
              console.warn('Erro no callback onError:', callbackError);
            }
          }
        });

        player.on('loadstart', () => {
          if (!mounted || isDisposed) return;
          setLoading(true);
          setError(null);
        });

        player.on('canplay', () => {
          if (!mounted || isDisposed) return;
          setLoading(false);
        });

        player.on('waiting', () => {
          if (!mounted || isDisposed) return;
          setLoading(true);
        });

        player.on('playing', () => {
          if (!mounted || isDisposed) return;
          setLoading(false);
        });

      } catch (error) {
        console.error('Erro ao inicializar Video.js:', error);
        if (mounted) {
          setError('Erro ao inicializar player');
          setLoading(false);
          
          // Retry logic
          if (retryCount < maxRetries) {
            console.log(`🔄 Tentativa ${retryCount + 1}/${maxRetries} de reinicializar player...`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (mounted && !isDisposed) {
                initializePlayer();
              }
            }, 1000 * (retryCount + 1));
          }
        }
      }
    };

    loadVideoJS();

    return () => {
      mounted = false;
      cleanupPlayer();
    };
  }, []); // Only run once on mount

  // Atualizar fonte quando src mudar
  useEffect(() => {
    if (isPlayerReady && playerRef.current && src && !isDisposed) {
      updatePlayerSource();
    }
  }, [src, isPlayerReady]);

  const updatePlayerSource = () => {
    if (!playerRef.current || !src || isDisposed) return;

    try {
      console.log('🎥 Atualizando fonte Video.js:', src);
      
      // Detectar tipo de fonte
      const isHLS = src.includes('.m3u8') || isLive;
      
      const sourceConfig = {
        src: src,
        type: isHLS ? 'application/x-mpegURL' : 'video/mp4',
        withCredentials: false
      };

      // Configurar headers de autenticação se necessário
      if (src.includes('/content/') || src.includes('/api/')) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          sourceConfig.withCredentials = true;
          // Para Video.js, configurar headers via xhr
          playerRef.current.ready(() => {
            if (isDisposed) return;
            
            try {
              const tech = playerRef.current.tech();
              if (tech && tech.hls) {
                tech.hls.xhr.beforeRequest = (options: any) => {
                  options.headers = options.headers || {};
                  options.headers['Authorization'] = `Bearer ${token}`;
                  return options;
                };
              }
            } catch (techError) {
              console.warn('Erro ao configurar headers:', techError);
            }
          });
        }
      }

      // Clear any existing source first
      playerRef.current.pause();
      playerRef.current.src('');
      
      // Wait a bit before setting new source
      setTimeout(() => {
        if (playerRef.current && !isDisposed) {
          playerRef.current.src(sourceConfig);
          
          if (autoplay) {
            setTimeout(() => {
              if (playerRef.current && !isDisposed) {
                playerRef.current.play().catch((error: any) => {
                  console.warn('Autoplay falhou:', error);
                });
              }
            }, 500);
          }
        }
      }, 100);
      
    } catch (error) {
      console.error('Erro ao atualizar fonte:', error);
      setError('Erro ao carregar vídeo');
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setRetryCount(0);
    
    if (playerRef.current && src && !isDisposed) {
      updatePlayerSource();
    } else {
      // Reinitialize player if needed
      cleanupPlayer();
      setTimeout(() => {
        if (!isDisposed) {
          window.location.reload(); // Force reload as last resort
        }
      }, 1000);
    }
  };

  const openInNewTab = () => {
    if (src) {
      // Para vídeos que precisam de token, construir URL externa
      if (src.includes('/content/') || src.includes('/api/')) {
        const token = localStorage.getItem('auth_token');
        const separator = src.includes('?') ? '&' : '?';
        const externalUrl = `${src}${separator}auth_token=${encodeURIComponent(token || '')}`;
        window.open(externalUrl, '_blank');
      } else {
        window.open(src, '_blank');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPlayer();
    };
  }, []);

  return (
    <div ref={containerRef} className={`videojs-player-container relative ${className}`}>
      {/* Estatísticas do stream */}
      {streamStats && showStats && (
        <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-80 text-white p-3 rounded-lg text-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Eye className="h-3 w-3" />
              <span>{streamStats.viewers || 0} espectadores</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="h-3 w-3" />
              <span>{streamStats.bitrate || 0} kbps</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3" />
              <span>{streamStats.uptime || '00:00:00'}</span>
            </div>
            {streamStats.quality && (
              <div className="flex items-center space-x-2">
                <Settings className="h-3 w-3" />
                <span>{streamStats.quality}</span>
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

      {/* Indicador de transmissão ao vivo */}
      {isLive && (
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center space-x-2 text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>AO VIVO</span>
          </div>
        </div>
      )}

      {/* Botão de estatísticas */}
      {streamStats && (
        <div className="absolute top-4 right-20 z-20">
          <button
            onClick={() => setShowStats(!showStats)}
            className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-opacity"
            title="Estatísticas"
          >
            <Activity className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-50 rounded-lg">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="text-white text-sm">
              {retryCount > 0 ? `Tentativa ${retryCount}/${maxRetries}...` : 'Carregando Video.js...'}
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-75 rounded-lg">
          <div className="flex flex-col items-center space-y-4 text-white text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Erro de Reprodução</h3>
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
                  <span>Abrir em Nova Aba</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder quando não há vídeo */}
      {!src && (
        <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex flex-col items-center justify-center text-white">
          <Play className="h-16 w-16 mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold mb-2">Video.js Player</h3>
          <p className="text-gray-400 text-center max-w-md">
            Player profissional com suporte completo a HLS, MP4 e recursos avançados
          </p>
        </div>
      )}

      {/* Elemento de vídeo para Video.js */}
      <video
        ref={videoRef}
        className={`video-js vjs-default-skin w-full ${!src ? 'hidden' : ''}`}
        controls={controls}
        preload="auto"
        data-setup="{}"
        playsInline
        crossOrigin="anonymous"
        style={{ display: src ? 'block' : 'none' }}
      />

      {/* Título do vídeo */}
      {title && src && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-none rounded-b-lg">
          <h3 className="text-white text-lg font-semibold truncate">{title}</h3>
          {streamStats && (
            <div className="text-white text-sm opacity-80 mt-1">
              {streamStats.quality && <span>{streamStats.quality}</span>}
              {streamStats.bitrate && <span> • {streamStats.bitrate} kbps</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoJSPlayer;