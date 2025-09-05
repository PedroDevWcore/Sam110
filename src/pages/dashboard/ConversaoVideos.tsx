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
    
    switch (video.conversion_status) {
      case 'concluida':
        return 'text-green-600';
      case 'em_andamento':
        return 'text-blue-600';
      case 'erro':
        return 'text-red-600';
      case 'disponivel':
        return 'text-green-600';
      default:
        // Verificar se pode usar o vídeo atual
        if (video.can_use_current && !video.needs_conversion) {
          return 'text-green-600';
        } else {
          return 'text-red-600';
        }
    }
  };

  const canConvert = (video: VideoConversion) => {
    return video.needs_conversion || !video.can_use_current;
  };

  const canPlay = (video: VideoConversion) => {
    return video.can_use_current || video.conversion_status === 'concluida' || video.conversion_status === 'disponivel';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Voltar
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900 flex items-center">
                <Settings className="h-6 w-6 mr-2 text-blue-600" />
                Conversão de Vídeos
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Folder Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Selecionar Pasta</h2>
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Selecione uma pasta...</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id.toString()}>
                {folder.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Videos List */}
        {selectedFolder && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-lg font-medium text-gray-900">
                Vídeos para Conversão
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Gerencie as conversões dos seus vídeos para otimizar a reprodução
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Carregando vídeos...</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="p-8 text-center">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum vídeo encontrado nesta pasta</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {videos.map((video) => (
                  <div key={video.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(video)}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {video.nome}
                            </h3>
                            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                              {video.duracao && (
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatDuration(video.duracao)}
                                </span>
                              )}
                              {video.tamanho && (
                                <span className="flex items-center">
                                  <HardDrive className="h-3 w-3 mr-1" />
                                  {formatFileSize(video.tamanho)}
                                </span>
                              )}
                              {video.current_bitrate && (
                                <span className="flex items-center">
                                  <Zap className="h-3 w-3 mr-1" />
                                  {video.current_bitrate} kbps
                                </span>
                              )}
                              {video.largura && video.altura && (
                                <span>
                                  {video.largura}x{video.altura}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 ml-4">
                        <div className="text-right">
                          <div className={`text-sm font-medium ${getStatusColor(video)}`}>
                            {getStatusText(video)}
                          </div>
                          {video.qualidade_conversao && (
                            <div className="text-xs text-gray-500 mt-1">
                              Qualidade: {video.qualidade_conversao}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {canPlay(video) && (
                            <button
                              onClick={() => openVideoPlayer(video)}
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Reproduzir vídeo"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}

                          {canConvert(video) && !converting[video.id] && (
                            <button
                              onClick={() => openConversionModal(video)}
                              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                              title="Converter vídeo"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                          )}

                          {video.conversion_status === 'concluida' && (
                            <button
                              onClick={() => removeConversion(video.id)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remover conversão"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compatibility Message */}
                    {video.compatibility_message && (
                      <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded p-2">
                        Status: {video.compatibility_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversion Modal */}
      {showConversionModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Configurar Conversão
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vídeo: {selectedVideo.nome}
                </label>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Bitrate atual: {selectedVideo.current_bitrate} kbps</div>
                  <div>Limite do usuário: {selectedVideo.user_bitrate_limit} kbps</div>
                  {selectedVideo.largura && selectedVideo.altura && (
                    <div>Resolução: {selectedVideo.largura}x{selectedVideo.altura}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuração Personalizada
                </label>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Bitrate (kbps)
                    </label>
                    <input
                      type="number"
                      value={conversionSettings.custom_bitrate}
                      onChange={(e) => setConversionSettings(prev => ({
                        ...prev,
                        custom_bitrate: parseInt(e.target.value) || 0
                      }))}
                      max={selectedVideo.user_bitrate_limit}
                      min={500}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Resolução
                    </label>
                    <select
                      value={conversionSettings.custom_resolution}
                      onChange={(e) => setConversionSettings(prev => ({
                        ...prev,
                        custom_resolution: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1920x1080">1920x1080 (Full HD)</option>
                      <option value="1280x720">1280x720 (HD)</option>
                      <option value="854x480">854x480 (SD)</option>
                      <option value="640x360">640x360 (Low)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowConversionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={startConversion}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Iniciar Conversão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {showPlayerModal && currentVideo && (
        <div className={`fixed inset-0 bg-black z-50 ${isFullscreen ? '' : 'bg-opacity-90 flex items-center justify-center p-4'}`}>
          <div className={`bg-black ${isFullscreen ? 'w-full h-full' : 'w-full max-w-4xl h-96 rounded-lg overflow-hidden'} relative`}>
            {/* Controls */}
            <div className="absolute top-4 right-4 z-10 flex space-x-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 bg-black bg-opacity-50 text-white rounded-lg hover:bg-opacity-70 transition-colors"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
              <button
                onClick={closeVideoPlayer}
                className="p-2 bg-black bg-opacity-50 text-white rounded-lg hover:bg-opacity-70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Player HTML5 Simples */}
            <div className={`w-full h-full ${isFullscreen ? 'p-0' : 'p-4 pt-16'}`}>
              <IFrameVideoPlayer
                src={videoUrl}
                title={currentVideo.nome}
                autoplay
                controls
                className="w-full h-full"
                onError={(error) => {
                  console.error('Erro no IFrame:', error);
                  toast.error('Erro ao carregar vídeo. Tente abrir em nova aba.');
                }}
                onReady={() => {
                  console.log('IFrame conversão pronto');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversaoVideos;