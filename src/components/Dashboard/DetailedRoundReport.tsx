import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Clock, Camera, AlertTriangle, User, Navigation, FileText, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DetailedRoundReportProps {
  roundId: string;
  onBack: () => void;
}

interface Round {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'incident';
  start_time?: string;
  end_time?: string;
  start_odometer?: number;
  end_odometer?: number;
  clients: {
    name: string;
    address: string;
  };
  profiles?: {
    name: string;
  } | null;
  vehicles?: {
    license_plate: string;
    brand: string;
    model: string;
  };
  round_templates?: {
    name: string;
  };
}

interface CheckpointVisit {
  id: string;
  checkpoint_id: string;
  visit_time: string;
  duration: number;
  lat?: number;
  lng?: number;
  status: string;
}

interface Photo {
  id: string;
  url: string;
  created_at: string;
  metadata?: any;
}

interface Incident {
  id: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  reported_at: string;
  lat?: number;
  lng?: number;
}

interface RoutePoint {
  id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  speed?: number;
}

const DetailedRoundReport = ({ roundId, onBack }: DetailedRoundReportProps) => {
  const [round, setRound] = useState<Round | null>(null);
  const [visits, setVisits] = useState<CheckpointVisit[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoundDetails();
  }, [roundId]);

  const fetchRoundDetails = async () => {
    try {
      // Fetch round data
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address),
          profiles (name),
          vehicles (license_plate, brand, model),
          round_templates (name)
        `)
        .eq("id", roundId)
        .maybeSingle();

      if (roundError) throw roundError;
      if (!roundData) {
        toast({
          title: "Ronda não encontrada",
          description: "A ronda solicitada não foi encontrada",
          variant: "destructive",
        });
        return;
      }

      setRound(roundData);

      // Fetch checkpoint visits
      const { data: visitsData, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("*")
        .eq("round_id", roundId)
        .order("visit_time");

      if (visitsError) throw visitsError;
      setVisits(visitsData || []);

      // Fetch photos
      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .eq("round_id", roundId)
        .order("created_at");

      if (photosError) throw photosError;
      setPhotos(photosData || []);

      // Fetch incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from("incidents")
        .select("*")
        .eq("round_id", roundId)
        .order("reported_at");

      if (incidentsError) throw incidentsError;
      setIncidents(incidentsData || []);

      // Fetch route points
      const { data: routeData, error: routeError } = await supabase
        .from("route_points")
        .select("*")
        .eq("round_id", roundId)
        .order("recorded_at");

      if (routeError) throw routeError;
      setRoutePoints(routeData || []);

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
      case 'completed': return 'bg-muted text-muted-foreground';
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
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const calculateTotalDistance = () => {
    if (routePoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < routePoints.length; i++) {
      const prev = routePoints[i - 1];
      const curr = routePoints[i];
      
      // Haversine formula for distance calculation
      const R = 6371; // Earth's radius in km
      const dLat = (curr.lat - prev.lat) * Math.PI / 180;
      const dLng = (curr.lng - prev.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    
    return totalDistance;
  };

  const calculateAverageSpeed = () => {
    if (!round?.start_time || !round?.end_time) return 0;
    
    const startTime = new Date(round.start_time);
    const endTime = new Date(round.end_time);
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const distance = calculateTotalDistance();
    
    return durationHours > 0 ? distance / durationHours : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando relatório da ronda...</p>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Ronda não encontrada</p>
          <Button onClick={onBack} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const totalDistance = calculateTotalDistance();
  const avgSpeed = calculateAverageSpeed();
  const totalOdometer = round.end_odometer && round.start_odometer 
    ? round.end_odometer - round.start_odometer 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Relatório da Ronda #{roundId.slice(-6)}
                </h1>
                <p className="text-muted-foreground">
                  {round.round_templates?.name || round.clients.name}
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(round.status)}>
              {getStatusLabel(round.status)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informações Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Informações Gerais</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="font-medium">{round.clients.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tático</p>
                      <p className="font-medium">{round.profiles?.name || 'Não atribuído'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Veículo</p>
                      <p className="font-medium">
                        {round.vehicles ? 
                          `${round.vehicles.license_plate} - ${round.vehicles.brand} ${round.vehicles.model}` 
                          : 'Não informado'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duração Total</p>
                      <p className="font-medium">
                        {formatDuration(round.start_time, round.end_time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Início</p>
                      <p className="font-medium">
                        {round.start_time ? 
                          new Date(round.start_time).toLocaleString('pt-BR') 
                          : 'Não iniciada'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fim</p>
                      <p className="font-medium">
                        {round.end_time ? 
                          new Date(round.end_time).toLocaleString('pt-BR') 
                          : 'Em andamento'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Checkpoints Visitados */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>Checkpoints Visitados ({visits.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {visits.map((visit, index) => (
                      <div key={visit.id} className="p-3 rounded-lg border bg-tactical-green/10 border-tactical-green/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Checkpoint {index + 1}</span>
                          <Badge variant="outline" className="text-tactical-green border-tactical-green">
                            Concluído
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(visit.visit_time).toLocaleString('pt-BR')}</span>
                            <span>({Math.floor(visit.duration / 60)}m {visit.duration % 60}s)</span>
                          </div>
                          {visit.lat && visit.lng && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>Lat: {visit.lat.toFixed(6)}, Lng: {visit.lng.toFixed(6)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {visits.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhum checkpoint visitado
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Ocorrências */}
              {incidents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-tactical-red" />
                      <span>Ocorrências ({incidents.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {incidents.map((incident) => (
                        <div key={incident.id} className="p-3 rounded-lg border bg-tactical-red/10 border-tactical-red/30">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium">{incident.title}</span>
                            <Badge variant="outline" className="text-tactical-red border-tactical-red">
                              {incident.priority}
                            </Badge>
                          </div>
                          {incident.description && (
                            <p className="text-sm text-muted-foreground mb-2">{incident.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(incident.reported_at).toLocaleString('pt-BR')}</span>
                            </div>
                            {incident.lat && incident.lng && (
                              <div className="flex items-center space-x-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                <span>Lat: {incident.lat.toFixed(6)}, Lng: {incident.lng.toFixed(6)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Stats & Photos */}
            <div className="space-y-6">
              {/* Estatísticas do Trajeto */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <RouteIcon className="h-5 w-5" />
                    <span>Estatísticas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Distância por GPS</p>
                    <p className="text-2xl font-bold text-foreground">
                      {totalDistance.toFixed(1)} km
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Velocidade Média</p>
                    <p className="text-2xl font-bold text-foreground">
                      {avgSpeed.toFixed(1)} km/h
                    </p>
                  </div>
                  <Separator />
                  {totalOdometer > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">KM no Odômetro</p>
                        <p className="text-2xl font-bold text-foreground">
                          {totalOdometer} km
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Inicial</p>
                          <p className="font-medium">{round.start_odometer?.toLocaleString()} km</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Final</p>
                          <p className="font-medium">{round.end_odometer?.toLocaleString()} km</p>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Pontos de Trajeto</p>
                    <p className="text-2xl font-bold text-foreground">
                      {routePoints.length}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Fotos da Ronda */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Camera className="h-5 w-5" />
                    <span>Fotos ({photos.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img 
                          src={photo.url} 
                          alt="Foto da ronda"
                          className="w-full h-20 object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <p className="text-white text-xs text-center p-1">
                            {new Date(photo.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {photos.length === 0 && (
                      <div className="col-span-2 text-center py-4 text-muted-foreground">
                        Nenhuma foto registrada
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default DetailedRoundReport;