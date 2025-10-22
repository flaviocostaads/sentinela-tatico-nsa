import { useState, useEffect } from "react";
import { Clock, MapPin, Camera, AlertTriangle, User, Navigation, FileText, Download, Filter, Car, Bike, CheckCircle, XCircle, Calendar, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Round {
  id: string;
  template_id?: string;
  user_id: string;
  client_id: string;
  vehicle: 'car' | 'motorcycle';
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  end_time?: string;
  start_odometer?: number;
  end_odometer?: number;
  created_at: string;
  clients: {
    name: string;
    address: string;
  };
  profiles?: {
    name: string;
  } | null;
  round_templates?: {
    name: string;
    shift_type: string;
    description?: string;
  };
}

interface CheckpointVisit {
  id: string;
  round_id: string;
  checkpoint_id: string;
  visit_time: string;
  duration: number;
  status: string;
  lat?: number;
  lng?: number;
}

interface Incident {
  id: string;
  round_id: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  reported_at: string;
  lat?: number;
  lng?: number;
}

interface Photo {
  id: string;
  url: string;
  round_id?: string;
  checkpoint_visit_id?: string;
  incident_id?: string;
  created_at: string;
  metadata?: any;
}

interface RoutePoint {
  id: string;
  round_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  speed?: number;
}

interface OdometerRecord {
  id: string;
  round_id?: string;
  odometer_reading: number;
  record_type: string;
  photo_url: string;
  recorded_at: string;
}

interface TemplateCheckpoint {
  id: string;
  client_id: string;
  order_index: number;
  estimated_duration_minutes: number;
  required_signature: boolean;
  clients: {
    id: string;
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  };
}

interface EnhancedRoundDetailsProps {
  round: Round;
  onClose?: () => void;
}

const EnhancedRoundDetails = ({ round, onClose }: EnhancedRoundDetailsProps) => {
  const [checkpointVisits, setCheckpointVisits] = useState<CheckpointVisit[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [odometerRecords, setOdometerRecords] = useState<OdometerRecord[]>([]);
  const [templateCheckpoints, setTemplateCheckpoints] = useState<TemplateCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoDialog, setPhotoDialog] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    type: 'all', // all, visited, pending, incidents, photos
    search: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRoundDetails();
  }, [round.id]);

  const fetchRoundDetails = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [
        visitsResponse,
        incidentsResponse,
        photosResponse,
        routeResponse,
        odometerResponse,
        templateResponse
      ] = await Promise.all([
        // Checkpoint visits
        supabase
          .from("checkpoint_visits")
          .select("*")
          .eq("round_id", round.id)
          .order("visit_time"),

        // Incidents
        supabase
          .from("incidents")
          .select("*")
          .eq("round_id", round.id)
          .order("reported_at"),

        // Photos
        supabase
          .from("photos")
          .select("*")
          .eq("round_id", round.id)
          .order("created_at"),

        // Route points
        supabase
          .from("route_points")
          .select("*")
          .eq("round_id", round.id)
          .order("recorded_at"),

        // Odometer records
        supabase
          .from("odometer_records")
          .select("*")
          .eq("round_id", round.id)
          .order("recorded_at"),

        // Template checkpoints
        round.template_id ? supabase
          .from("round_template_checkpoints")
          .select(`
            *,
            clients (id, name, address, lat, lng)
          `)
          .eq("template_id", round.template_id)
          .order("order_index") : Promise.resolve({ data: [], error: null })
      ]);

      if (visitsResponse.error) throw visitsResponse.error;
      if (incidentsResponse.error) throw incidentsResponse.error;
      if (photosResponse.error) throw photosResponse.error;
      if (routeResponse.error) throw routeResponse.error;
      if (odometerResponse.error) throw odometerResponse.error;
      if (templateResponse.error) throw templateResponse.error;

      setCheckpointVisits(visitsResponse.data || []);
      setIncidents(incidentsResponse.data || []);
      setPhotos(photosResponse.data || []);
      setRoutePoints(routeResponse.data || []);
      setOdometerRecords(odometerResponse.data || []);
      setTemplateCheckpoints(templateResponse.data || []);
    } catch (error) {
      console.error("Error fetching round details:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da ronda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'bg-tactical-green text-white';
      case 'incident': return 'bg-tactical-red text-white';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'pending': return 'bg-tactical-amber text-white';
      default: return 'bg-muted';
    }
  };

  const getStatusLabel = (status: Round['status']) => {
    switch (status) {
      case 'active': return 'Em Andamento';
      case 'incident': return 'Com Ocorrência';
      case 'completed': return 'Concluída';
      case 'pending': return 'Aguardando';
      default: return status;
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return '-';
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  const calculateDistance = () => {
    if (routePoints.length < 2) return 0;
    
    let distance = 0;
    for (let i = 1; i < routePoints.length; i++) {
      const prev = routePoints[i - 1];
      const curr = routePoints[i];
      
      // Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (curr.lat - prev.lat) * Math.PI / 180;
      const dLng = (curr.lng - prev.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance += R * c;
    }
    
    return Math.round(distance * 100) / 100;
  };

  const downloadRouteMap = async () => {
    if (routePoints.length < 2) {
      toast({
        title: "Aviso",
        description: "Não há dados de trajeto suficientes para gerar o mapa",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a simple SVG map representation
      const margin = 50;
      const width = 800;
      const height = 600;
      
      // Find bounds
      const lats = routePoints.map(p => p.lat);
      const lngs = routePoints.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      // Add padding
      const latRange = maxLat - minLat || 0.01;
      const lngRange = maxLng - minLng || 0.01;
      const padding = Math.max(latRange, lngRange) * 0.1;
      
      const adjustedMinLat = minLat - padding;
      const adjustedMaxLat = maxLat + padding;
      const adjustedMinLng = minLng - padding;
      const adjustedMaxLng = maxLng + padding;
      
      // Scale points to SVG coordinates
      const scaleX = (width - 2 * margin) / (adjustedMaxLng - adjustedMinLng);
      const scaleY = (height - 2 * margin) / (adjustedMaxLat - adjustedMinLat);
      
      const scaledPoints = routePoints.map(p => ({
        x: margin + (p.lng - adjustedMinLng) * scaleX,
        y: height - margin - (p.lat - adjustedMinLat) * scaleY,
        time: p.recorded_at
      }));
      
      // Create SVG
      const pathData = scaledPoints.map((p, i) => 
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
      ).join(' ');
      
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              .route-path { fill: none; stroke: #2563eb; stroke-width: 3; }
              .start-point { fill: #16a34a; }
              .end-point { fill: #dc2626; }
              .checkpoint { fill: #f59e0b; }
              .text { font-family: Arial, sans-serif; font-size: 12px; fill: #374151; }
              .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; fill: #1f2937; }
            </style>
          </defs>
          
          <!-- Background -->
          <rect width="${width}" height="${height}" fill="#f9fafb" stroke="#e5e7eb"/>
          
          <!-- Title -->
          <text x="${width/2}" y="30" text-anchor="middle" class="title">
            Trajeto da Ronda - ${round.clients.name}
          </text>
          
          <!-- Route path -->
          <path d="${pathData}" class="route-path"/>
          
          <!-- Start point -->
          <circle cx="${scaledPoints[0]?.x}" cy="${scaledPoints[0]?.y}" r="6" class="start-point"/>
          <text x="${scaledPoints[0]?.x + 10}" y="${scaledPoints[0]?.y + 5}" class="text">Início</text>
          
          <!-- End point -->
          <circle cx="${scaledPoints[scaledPoints.length - 1]?.x}" cy="${scaledPoints[scaledPoints.length - 1]?.y}" r="6" class="end-point"/>
          <text x="${scaledPoints[scaledPoints.length - 1]?.x + 10}" y="${scaledPoints[scaledPoints.length - 1]?.y + 5}" class="text">Fim</text>
          
          <!-- Legend -->
          <g transform="translate(20, ${height - 80})">
            <rect x="0" y="0" width="150" height="60" fill="white" stroke="#e5e7eb" rx="5"/>
            <circle cx="15" cy="15" r="4" class="start-point"/>
            <text x="25" y="19" class="text">Ponto de Início</text>
            <circle cx="15" cy="35" r="4" class="end-point"/>
            <text x="25" y="39" class="text">Ponto Final</text>
            <line x1="15" y1="50" x2="35" y2="50" class="route-path"/>
            <text x="40" y="54" class="text">Trajeto</text>
          </g>
          
          <!-- Statistics -->
          <g transform="translate(${width - 200}, 50)">
            <rect x="0" y="0" width="180" height="120" fill="white" stroke="#e5e7eb" rx="5"/>
            <text x="10" y="20" class="text" font-weight="bold">Estatísticas:</text>
            <text x="10" y="40" class="text">Distância: ${calculateDistance()} km</text>
            <text x="10" y="55" class="text">Pontos: ${routePoints.length}</text>
            <text x="10" y="70" class="text">Duração: ${formatDuration(round.start_time, round.end_time)}</text>
            <text x="10" y="85" class="text">Tático: ${round.profiles?.name || 'Não atribuído'}</text>
            <text x="10" y="100" class="text">Data: ${round.start_time ? new Date(round.start_time).toLocaleDateString('pt-BR') : '-'}</text>
          </g>
        </svg>
      `;
      
      // Convert SVG to downloadable file
      const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
      const url = window.URL.createObjectURL(svgBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mapa_trajeto_ronda_${round.id}_${new Date().toISOString().split('T')[0]}.svg`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Sucesso",
        description: "Mapa do trajeto baixado com sucesso!",
      });
    } catch (error) {
      console.error("Error generating route map:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar mapa do trajeto",
        variant: "destructive",
      });
    }
  };

  const exportRoundReport = () => {
    const reportData = {
      ronda: {
        id: round.id,
        template: round.round_templates?.name || 'N/A',
        turno: round.round_templates?.shift_type || 'N/A',
        tatico: round.profiles?.name || 'Não atribuído',
        cliente: round.clients.name,
        veiculo: round.vehicle === 'car' ? 'Carro' : 'Moto',
        status: getStatusLabel(round.status),
        inicio: round.start_time ? new Date(round.start_time).toLocaleString('pt-BR') : '-',
        fim: round.end_time ? new Date(round.end_time).toLocaleString('pt-BR') : '-',
        duracao: formatDuration(round.start_time, round.end_time)
      },
      estatisticas: {
        totalCheckpoints: templateCheckpoints.length,
        checkpointsVisitados: checkpointVisits.length,
        incidentes: incidents.length,
        fotos: photos.length,
        distanciaPercorrida: `${calculateDistance()} km`,
        pontosDeRota: routePoints.length
      },
      checkpoints: templateCheckpoints.map(cp => {
        const visit = checkpointVisits.find(v => 
          v.checkpoint_id === `template_${cp.id}` || 
          v.checkpoint_id === cp.id
        );
        return {
          nome: cp.clients.name,
          endereco: cp.clients.address,
          status: visit ? 'Visitado' : 'Não visitado',
          horario: visit ? new Date(visit.visit_time).toLocaleString('pt-BR') : '-',
          duracao: visit ? `${Math.floor(visit.duration / 60)}m` : '-'
        };
      })
    };

    const csv = [
      '=== RELATÓRIO DE RONDA ===',
      '',
      'INFORMAÇÕES GERAIS',
      `ID da Ronda,${reportData.ronda.id}`,
      `Template,${reportData.ronda.template}`,
      `Turno,${reportData.ronda.turno}`,
      `Tático,${reportData.ronda.tatico}`,
      `Cliente,${reportData.ronda.cliente}`,
      `Veículo,${reportData.ronda.veiculo}`,
      `Status,${reportData.ronda.status}`,
      `Início,${reportData.ronda.inicio}`,
      `Fim,${reportData.ronda.fim}`,
      `Duração,${reportData.ronda.duracao}`,
      '',
      'ESTATÍSTICAS',
      `Total de Checkpoints,${reportData.estatisticas.totalCheckpoints}`,
      `Checkpoints Visitados,${reportData.estatisticas.checkpointsVisitados}`,
      `Incidentes,${reportData.estatisticas.incidentes}`,
      `Fotos,${reportData.estatisticas.fotos}`,
      `Distância Percorrida,${reportData.estatisticas.distanciaPercorrida}`,
      `Pontos de Rota,${reportData.estatisticas.pontosDeRota}`,
      '',
      'CHECKPOINTS',
      'Nome,Endereço,Status,Horário,Duração',
      ...reportData.checkpoints.map(cp => 
        `${cp.nome},${cp.endereco},${cp.status},${cp.horario},${cp.duracao}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_ronda_${round.id}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredCheckpoints = templateCheckpoints.filter(cp => {
    if (filter.search && !cp.clients.name.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }
    
    const visit = checkpointVisits.find(v => 
      v.checkpoint_id === `template_${cp.id}` || 
      v.checkpoint_id === cp.id
    );
    
    switch (filter.type) {
      case 'visited': return !!visit;
      case 'pending': return !visit;
      default: return true;
    }
  });

  if (loading) {
    return (
      <div className="p-6 rounded-lg border tactical-card bg-card">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando detalhes da ronda...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-lg border tactical-card bg-card max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <h3 className="text-2xl font-bold text-foreground">
              Detalhes da Ronda - {round.clients.name}
            </h3>
            <Badge className={getStatusColor(round.status)}>
              {getStatusLabel(round.status)}
            </Badge>
          </div>
          <div className="flex items-center space-x-4 text-muted-foreground">
            <div className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span>Tático: {round.profiles?.name || 'Não atribuído'}</span>
            </div>
            <div className="flex items-center space-x-1">
              {round.vehicle === 'car' ? <Car className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
              <span>{round.vehicle === 'car' ? 'Viatura' : 'Motocicleta'}</span>
            </div>
            {round.round_templates && (
              <div className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>Template: {round.round_templates.name}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={exportRoundReport} size="sm" className="bg-tactical-blue hover:bg-tactical-blue/90">
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório
          </Button>
          <Button onClick={downloadRouteMap} size="sm" variant="outline">
            <Route className="w-4 h-4 mr-2" />
            Baixar Mapa
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Geral</TabsTrigger>
          <TabsTrigger value="checkpoints">Pontos ({templateCheckpoints.length})</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes ({incidents.length})</TabsTrigger>
          <TabsTrigger value="photos">Fotos ({photos.length})</TabsTrigger>
          <TabsTrigger value="route">Trajeto ({routePoints.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-tactical-green" />
                  <span className="text-sm text-muted-foreground">Checkpoints</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {checkpointVisits.length}/{templateCheckpoints.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-tactical-red" />
                  <span className="text-sm text-muted-foreground">Incidentes</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{incidents.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-tactical-blue" />
                  <span className="text-sm text-muted-foreground">Fotos</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{photos.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-5 h-5 text-tactical-amber" />
                  <span className="text-sm text-muted-foreground">Distância</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{calculateDistance()} km</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Ronda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Template</p>
                    <p className="font-medium text-foreground">{round.round_templates?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Turno</p>
                    <p className="font-medium text-foreground">{round.round_templates?.shift_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Início</p>
                    <p className="font-medium text-foreground">
                      {round.start_time ? new Date(round.start_time).toLocaleString('pt-BR') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fim</p>
                    <p className="font-medium text-foreground">
                      {round.end_time ? new Date(round.end_time).toLocaleString('pt-BR') : 'Em andamento'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duração</p>
                    <p className="font-medium text-foreground">
                      {formatDuration(round.start_time, round.end_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Progresso</p>
                    <p className="font-medium text-foreground">
                      {templateCheckpoints.length > 0 
                        ? `${Math.round((checkpointVisits.length / templateCheckpoints.length) * 100)}%`
                        : '0%'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Odômetro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {odometerRecords.map(record => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div>
                        <p className="font-medium">{record.record_type === 'start' ? 'Saída da Base' : 'Chegada na Base'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(record.recorded_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{record.odometer_reading.toLocaleString()} km</p>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setPhotoDialog(record.photo_url)}
                        >
                          <Camera className="w-3 h-3 mr-1" />
                          Ver Foto
                        </Button>
                      </div>
                    </div>
                  ))}
                  {odometerRecords.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum registro de odômetro encontrado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="checkpoints" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nome do checkpoint..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>
            <Select value={filter.type} onValueChange={(value) => setFilter({ ...filter, type: value })}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="visited">Visitados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredCheckpoints.map((checkpoint) => {
              const visit = checkpointVisits.find(v => 
                v.checkpoint_id === `template_${checkpoint.id}` || 
                v.checkpoint_id === checkpoint.id
              );
              
              return (
                <Card key={checkpoint.id} className={visit ? 'border-tactical-green' : 'border-muted'}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-foreground">{checkpoint.clients.name}</h4>
                          {visit ? (
                            <Badge className="bg-tactical-green text-white">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Visitado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <XCircle className="w-3 h-3 mr-1" />
                              Não visitado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{checkpoint.clients.address}</p>
                        {visit && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3" />
                              <span>Visitado em: {new Date(visit.visit_time).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3" />
                              <span>Duração: {Math.floor(visit.duration / 60)}m {visit.duration % 60}s</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-2">
                        <div className="text-sm text-muted-foreground">
                          Ordem: #{checkpoint.order_index}
                        </div>
                        {checkpoint.required_signature && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => {
                              // Find signature photo for this checkpoint
                              const signaturePhoto = photos.find(p => 
                                p.checkpoint_visit_id === visit?.id && 
                                p.metadata?.type === 'signature'
                              );
                              if (signaturePhoto) {
                                setPhotoDialog(signaturePhoto.url);
                              } else {
                                toast({
                                  title: "Aviso",
                                  description: "Nenhuma assinatura encontrada para este checkpoint",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Assinatura obrigatória
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {incidents.length > 0 ? (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <Card key={incident.id} className="border-tactical-red">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="space-y-1">
                        <h4 className="font-semibold text-foreground">{incident.title}</h4>
                        <p className="text-sm text-muted-foreground">{incident.description}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <Badge className="bg-tactical-red text-white">{incident.priority}</Badge>
                        <p className="text-xs text-muted-foreground">{incident.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Reportado em: {new Date(incident.reported_at).toLocaleString('pt-BR')}</span>
                      <span>Status: {incident.status}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum incidente reportado nesta ronda</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <Card key={photo.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-2">
                    <img
                      src={photo.url}
                      alt="Foto da ronda"
                      className="w-full h-32 object-cover rounded-md mb-2"
                      onClick={() => setPhotoDialog(photo.url)}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      {new Date(photo.created_at).toLocaleString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma foto registrada nesta ronda</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="route" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <Navigation className="w-8 h-8 text-tactical-blue mx-auto mb-2" />
                <p className="text-lg font-bold">{routePoints.length}</p>
                <p className="text-sm text-muted-foreground">Pontos de GPS</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Route className="w-8 h-8 text-tactical-green mx-auto mb-2" />
                <p className="text-lg font-bold">{calculateDistance()} km</p>
                <p className="text-sm text-muted-foreground">Distância Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 text-tactical-amber mx-auto mb-2" />
                <p className="text-lg font-bold">
                  {routePoints.length > 0 && round.start_time && round.end_time 
                    ? `${Math.round(calculateDistance() / (new Date(round.end_time).getTime() - new Date(round.start_time).getTime()) * 3600000)} km/h`
                    : '-'
                  }
                </p>
                <p className="text-sm text-muted-foreground">Velocidade Média</p>
              </CardContent>
            </Card>
          </div>

          {routePoints.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {routePoints.map((point, index) => (
                <div key={point.id} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <div>
                    <span className="text-sm font-medium">Ponto #{index + 1}</span>
                    <p className="text-xs text-muted-foreground">
                      Lat: {point.lat.toFixed(6)}, Lng: {point.lng.toFixed(6)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {new Date(point.recorded_at).toLocaleTimeString('pt-BR')}
                    </p>
                    {point.speed && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(point.speed)} km/h
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Navigation className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum ponto de trajeto registrado</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Photo Dialog */}
      <Dialog open={!!photoDialog} onOpenChange={() => setPhotoDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Foto da Ronda</DialogTitle>
          </DialogHeader>
          {photoDialog && (
            <img
              src={photoDialog}
              alt="Foto da ronda"
              className="w-full h-auto max-h-96 object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedRoundDetails;