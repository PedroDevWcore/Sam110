import React, { useState, useEffect } from 'react';
import { ChevronLeft, Video, Settings, Play, Trash2, RefreshCw, AlertCircle, CheckCircle, Zap, HardDrive, Clock, Download, X, Maximize, Minimize } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import IFrameVideoPlayer from '../../components/IFrameVideoPlayer';

interface VideoConversion {
  id: number;
  nome: string;
  url: string;
  duracao?: number;
  tamanho?: number;
  bitrate_video?: number;
  formato_original?: string;
  codec_video?: string;
  largura?: number;
  altura?: number;
  status_conversao?: 'nao_iniciada' | 'em_andamento' | 'concluida' | 'erro';
  path_video_mp4?: string;
  data_conversao?: string;
  is_mp4: boolean;
  current_bitrate: number;
  user_bitrate_limit: number;
  available_qualities: Array<{
    quality: string;
    bitrate: number;
    resolution: string;
    canConvert: boolean;
    reason?: string;
    description: string;
  }>;
  can_use_current: boolean;
  needs_conversion: boolean;
  conversion_status: string;
  compatibility_status?: string;
  compatibility_message?: string;
  qualidade_conversao?: string;
}

interface Folder {
  id: number;
  nome: string;
}

interface QualityPreset {
  quality: string;
  label: string;
  bitrate: number;
  resolution: string;
  available: boolean;
  description: string;
}

interface ConversionSettings {
  quality?: string;
  custom_bitrate?: number;
  custom_resolution?: string;
  use_custom: boolean;
}

const ConversaoVideos: React.FC = () => {
  const { getToken, user } = useAuth();
  const [videos, setVideos] = useState<VideoConversion[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState<Record<number, boolean>>({});
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoConversion | null>(null);
  const [conversionSettings, setConversionSettings] = useState<ConversionSettings>({
    quality: 'custom',
    custom_bitrate: 2500,
    custom_resolution: '1920x1080',
    use_custom: false
  });
  const [qualityPresets, setQualityPresets] = useState<QualityPreset[]>([]);

  // Player modal state
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoConversion | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoHlsUrl, setVideoHlsUrl] = useState('');

  // Função para construir URL do player externo
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

  useEffect(() => {
    loadFolders();
    loadQualityPresets();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      loadVideos();
    }
  }, [selectedFolder]);

  useEffect(() => {
    if (!currentVideo) return;

    // Construir URL do player externo
    const playerUrl = buildExternalPlayerUrl(currentVideo.url);
    setVideoUrl(playerUrl);
    setVideoHlsUrl(playerUrl);
  }, [currentVideo]);

  const loadFolders = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setFolders(data);

      // Selecionar primeira pasta por padrão
      if (data.length > 0) {
        setSelectedFolder(data[0].id.toString());
      }
    } catch (error) {
      toast.error('Erro ao carregar pastas');
    }
  };

  const loadQualityPresets = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/conversion/qualities', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setQualityPresets(data.qualities);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar qualidades:', error);
    }
  };

  const loadVideos = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      
      if (!selectedFolder) {
        setVideos([]);
        return;
      }
      
      console.log(`📊 Carregando vídeos para conversão da pasta ${selectedFolder}...`);

      const response = await fetch(`/api/conversion/videos?folder_id=${selectedFolder}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVideos(data.videos);
          console.log(`📊 Carregados ${data.videos.length} vídeos para conversão`);
          
          if (data.videos.length === 0) {
            console.log('Nenhum vídeo encontrado, tentando sincronizar...');
            
            // Tentar sincronizar se não há vídeos
            try {
              await fetch(`/api/videos-ssh/sync-database`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ folderId: selectedFolder })
              });
              
              // Tentar carregar novamente após sincronização
              const retryResponse = await fetch(`/api/conversion/videos?folder_id=${selectedFolder}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                if (retryData.success && retryData.videos.length > 0) {
                  setVideos(retryData.videos);
                  toast.success(`Sincronização: ${retryData.videos.length} vídeos encontrados`);
                } else {
                  toast.info('Nenhum vídeo encontrado na pasta selecionada');
                }
              }
            } catch (syncError) {
              console.warn('Erro na sincronização:', syncError);
              toast.info('Nenhum vídeo encontrado na pasta selecionada');
            }
          }
        }
      } else {
        const errorData = await response.json();
        console.error('Erro na resposta da API:', errorData);
        toast.error('Erro ao carregar vídeos para conversão: ' + (errorData.error || errorData.details || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
      toast.error('Erro ao carregar vídeos para conversão');
    } finally {
      setLoading(false);
    }
  };

  const openConversionModal = (video: VideoConversion) => {
    setSelectedVideo(video);

    // Sempre começar com configuração customizada
    const currentBitrate = video.current_bitrate || user?.bitrate || 2500;
    const maxBitrate = user?.bitrate || 2500;

    setConversionSettings({
      quality: 'custom',
      custom_bitrate: Math.min(currentBitrate, maxBitrate),
      custom_resolution: '1920x1080',
      use_custom: true
    });
    setShowConversionModal(true);
  };

  const startConversion = async () => {
    if (!selectedVideo) return;

    setConverting(prev => ({ ...prev, [selectedVideo.id]: true }));
    setShowConversionModal(false);

    try {
      const token = await getToken();
      const requestBody = {
        video_id: selectedVideo.id,
        use_custom: conversionSettings.use_custom,
        ...(conversionSettings.use_custom ? {
          custom_bitrate: conversionSettings.custom_bitrate,
          custom_resolution: conversionSettings.custom_resolution
        } : {
          quality: conversionSettings.quality
        })
      };

      const response = await fetch('/api/conversion/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Conversão iniciada com sucesso!');

        // Atualizar status do vídeo
        setVideos(prev => prev.map(v =>
          v.id === selectedVideo.id ?
            { ...v, status_conversao: 'em_andamento' } : v
        ));

        // Verificar progresso a cada 5 segundos
        const progressInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/conversion/status/${selectedVideo.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.success) {
                const status = statusData.conversion_status.status;

                if (status === 'concluida') {
                  clearInterval(progressInterval);
                  setConverting(prev => ({ ...prev, [selectedVideo.id]: false }));
                  toast.success(`Conversão de "${selectedVideo.nome}" concluída!`);
                  loadVideos(); // Recarregar lista
                } else if (status === 'erro') {
                  clearInterval(progressInterval);
                  setConverting(prev => ({ ...prev, [selectedVideo.id]: false }));
                  toast.error(`Erro na conversão de "${selectedVideo.nome}"`);
                  loadVideos();
                }
              }
            }
          } catch (error) {
            console.error('Erro ao verificar progresso:', error);
          }
        }, 5000);

        // Timeout de 10 minutos
        setTimeout(() => {
          clearInterval(progressInterval);
          setConverting(prev => ({ ...prev, [selectedVideo.id]: false }));
        }, 600000);

      } else {
        toast.error(result.error || 'Erro ao iniciar conversão');
      }
    } catch (error) {
      console.error('Erro ao converter vídeo:', error);
      toast.error('Erro ao converter vídeo');
    } finally {
      setConverting(prev => ({ ...prev, [selectedVideo.id]: false }));
    }
  };

  const removeConversion = async (videoId: number) => {
    if (!confirm('Deseja remover a conversão deste vídeo?')) return;

    try {
      const token = await getToken();
      const response = await fetch(`/api/conversion/${videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Conversão removida com sucesso!');
        loadVideos();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao remover conversão');
      }
    } catch (error) {
      toast.error('Erro ao remover conversão');
    }
  };

  const openVideoPlayer = (video: VideoConversion) => {
    setCurrentVideo(video);
    setShowPlayerModal(true);
  };

  const closeVideoPlayer = () => {
    setShowPlayerModal(false);
    setCurrentVideo(null);
    setIsFullscreen(false);
  };

  const buildVideoUrl = (url: string) => {
    if (!url) return '';

    // Se já é uma URL completa, usar como está
    if (url.startsWith('http')) {
      return url;
    }

    // Para vídeos SSH, usar URL diretamente
    if (url.includes('/api/videos-ssh/')) {
      return url;
    }

    // Construir URL HLS do Wowza baseada na estrutura
    const cleanPath = url.replace(/^\/+/, '');
    const pathParts = cleanPath.split('/');
    
    if (pathParts.length >= 3) {
      const userLogin = pathParts[0];
      const folderName = pathParts[1];
      const fileName = pathParts[2];
      
      // Garantir que é MP4
      const finalFileName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');
      
      // SEMPRE usar o IP do servidor Wowza
      const wowzaHost = '51.222.156.223';
      
      return `http://${wowzaHost}:1935/vod/_definst_/mp4:${userLogin}/${folderName}/${finalFileName}/playlist.m3u8`;
    }
    
    // Fallback para /content
    const token = localStorage.getItem('auth_token');
    const baseUrl = `/content/${cleanPath}`;
    return token ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}auth_token=${encodeURIComponent(token)}` : baseUrl;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (video: VideoConversion) => {
    if (converting[video.id]) {
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
    }

    switch (video.status_conversao) {
      case 'concluida':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'em_andamento':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'erro':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Video className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (video: VideoConversion) => {
    if (converting[video.id]) {
      return 'Convertendo...';
    }

    // Lógica atualizada baseada na compatibilidade
    if (video.compatibility_message === 'Otimizado') {
      return 'Otimizado';
    }
    
    if (video.compatibility_message === 'Necessário Conversão') {
      return 'Necessário Conversão';
    }
    
    switch (video.conversion_status) {
      case 'concluida':
        return 'Otimizado';
      case 'em_andamento':
        return 'Convertendo...';
      case 'erro':
        return 'Erro na conversão';
      case 'disponivel':
        return 'Otimizado';
      default:
        // Verificar se pode usar o vídeo atual
        if (video.can_use_current && !video.needs_conversion) {
          return 'Otimizado';
        } else {
          return 'Necessário Conversão';
        }
    }
  };

  const getStatusColor = (video: VideoConversion) => {
    if (converting[video.id]) {
      return 'text-blue-600';
    }

    // Lógica atualizada baseada na compatibilidade
    if (video.compatibility_message === 'Otimizado') {
      return 'text-green-600';
    }
    
    if (video.compatibility_message === 'Necessário Conversão') {
      return 'text-red-600';
    }
    
    switch (video
    )
  }
}