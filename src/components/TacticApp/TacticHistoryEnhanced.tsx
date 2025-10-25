import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Clock, Navigation, MapPin, CheckCircle, AlertTriangle, Car, User, Fuel, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface TacticHistoryProps {
  onBack: () => void;
}

interface HistoryRound {
  id: string;
  status: 'completed' | 'incident' | 'active' | 'pending';
  start_time: string;
  end_time?: string;
  created_at: string;
  template_id?: string;
  initial_odometer?: number;
  final_odometer?: number;
  clients: {
    name: string;
    address: string;
  };
  vehicles?: {
    license_plate: string;
    brand: string;
    model: string;
  };
  profiles?: {
    name: string;
    avatar_url?: string;
  };
  round_templates?: {
    name: string;
  };
  checkpointVisits: number;
  totalCheckpoints: number;
  incidents: Array<{
    id: string;
    title: string;
    type: string;
    priority: string;
    reported_at: string;
  }>;
  routePoints: Array<{
    lat: number;
    lng: number;
  }>;
  fuelConsumption?: number;
  distanceKm?: number;
}

const TacticHistoryEnhanced = ({ onBack }: TacticHistoryProps) => {
  const [rounds, setRounds] = useState<HistoryRound[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const { toast } = useToast();
  const mapRefs = useRef<{ [key: string]: mapboxgl.Map }>({});

  const mapboxToken = 'pk.eyJ1IjoiZmxhdmlvY29zdGFhZHMiLCJhIjoiY21laHB4MzVnMGE3ZjJycHVjZnN0N3d4cCJ9.slf_UnkEO8ekt3OU1HttLA';

  useEffect(() => {
    fetchHistory();
    return () => {
      // Cleanup maps
      Object.values(mapRefs.current).forEach(map => map.remove());
    };
  }, [selectedPeriod]);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      let startDate: Date;
      
      switch (selectedPeriod) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      // Fetch completed rounds with tactic info and template
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address),
          vehicles (license_plate, brand, model),
          profiles (name, avatar_url),
          round_templates (name)
        `)
        .eq("user_id", user.id)
        .in("status", ["completed", "incident"])
        .gte("created_at", startDate.toISOString())
        .order("end_time", { ascending: false });

      if (roundsError) throw roundsError;

      if (!roundsData || roundsData.length === 0) {
        setRounds([]);
        return;
      }

      // Fetch additional data for each round
      const enrichedRounds = await Promise.all(
        roundsData.map(async (round) => {
          // Get checkpoint visits count and total checkpoints
          const { data: visitsData } = await supabase
            .from("checkpoint_visits")
            .select("id")
            .eq("round_id", round.id);

          // Get total checkpoints from template if exists
          let totalCheckpoints = 0;
          if (round.template_id) {
            const { data: templateCheckpoints } = await supabase
              .from("round_template_checkpoints")
              .select("id")
              .eq("template_id", round.template_id);
            totalCheckpoints = templateCheckpoints?.length || 0;
          }

          // Get incidents for this round
          const { data: incidentsData } = await supabase
            .from("incidents")
            .select("id, title, type, priority, reported_at")
            .eq("round_id", round.id);

          // Get route points
          const { data: routeData } = await supabase
            .from("route_points")
            .select("lat, lng")
            .eq("round_id", round.id)
            .order("recorded_at", { ascending: true });

          // Calculate distance and fuel consumption
          let distanceKm = 0;
          if (round.initial_odometer && round.final_odometer) {
            distanceKm = round.final_odometer - round.initial_odometer;
          }

          // Get fuel consumption if available
          const { data: fuelData } = await supabase
            .from("vehicle_fuel_logs")
            .select("fuel_amount")
            .eq("round_id", round.id);

          const fuelConsumption = fuelData?.reduce((sum, log) => sum + Number(log.fuel_amount), 0) || 0;

          return {
            ...round,
            checkpointVisits: visitsData?.length || 0,
            totalCheckpoints,
            incidents: incidentsData || [],
            routePoints: routeData || [],
            distanceKm,
            fuelConsumption
          } as HistoryRound;
        })
      );

      setRounds(enrichedRounds);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeMiniMap = (roundId: string, routePoints: Array<{lat: number, lng: number}>) => {
    const mapContainer = document.getElementById(`map-${roundId}`);
    if (!mapContainer || routePoints.length === 0 || mapRefs.current[roundId]) return;

    mapboxgl.accessToken = mapboxToken;

    try {
      const map = new mapboxgl.Map({
        container: mapContainer,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [routePoints[0].lng, routePoints[0].lat],
        zoom: 12,
        interactive: false
      });

      map.on('load', () => {
        // Add route line
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routePoints.map(p => [p.lng, p.lat])
            }
          }
        });

        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': 'hsl(var(--tactical-blue))',
            'line-width': 3
          }
        });

        // Fit bounds to route
        const bounds = new mapboxgl.LngLatBounds();
        routePoints.forEach(p => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 20 });
      });

      mapRefs.current[roundId] = map;
    } catch (error) {
      console.error("Error initializing mini map:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return '--';
    
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diff = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-tactical-green text-white';
      case 'incident': return 'bg-tactical-red text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'incident': return 'Com Incidente';
      default: return status;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'today': return 'Hoje';
      case 'week': return 'Últimos 7 dias';
      case 'month': return 'Este mês';
      default: return period;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Histórico de Rondas</h1>
              <p className="text-sm text-muted-foreground">
                {rounds.length} ronda{rounds.length !== 1 ? 's' : ''} - {getPeriodLabel(selectedPeriod)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="p-4 border-b">
        <div className="flex space-x-2">
          {(['today', 'week', 'month'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {getPeriodLabel(period)}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {rounds.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma ronda encontrada</h3>
              <p className="text-muted-foreground">
                Não há rondas finalizadas no período selecionado.
              </p>
            </CardContent>
          </Card>
        ) : (
          rounds.map((round) => (
            <Card key={round.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-card to-muted/30 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Tactic Avatar */}
                    {round.profiles && (
                      <Avatar className="w-12 h-12 border-2 border-border">
                        <AvatarImage src={round.profiles.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {round.profiles.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">
                          {round.profiles?.name || 'Tático'}
                        </span>
                      </div>
                      <CardTitle className="text-lg mb-1">{round.clients.name}</CardTitle>
                      {round.round_templates && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                          <RouteIcon className="w-3 h-3" />
                          <span>Template: {round.round_templates.name}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{round.clients.address}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Badge className={getStatusColor(round.status)}>
                    {getStatusLabel(round.status)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-4">
                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="w-4 h-4 text-tactical-blue" />
                      <p className="text-xs text-muted-foreground">Data</p>
                    </div>
                    <p className="font-semibold text-foreground">{formatDate(round.created_at)}</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="w-4 h-4 text-tactical-green" />
                      <p className="text-xs text-muted-foreground">Duração</p>
                    </div>
                    <p className="font-semibold text-foreground">{formatDuration(round.start_time, round.end_time)}</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-tactical-green" />
                      <p className="text-xs text-muted-foreground">Checkpoints</p>
                    </div>
                    <p className="font-semibold text-foreground">
                      {round.checkpointVisits}/{round.totalCheckpoints}
                    </p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Navigation className="w-4 h-4 text-tactical-amber" />
                      <p className="text-xs text-muted-foreground">KM</p>
                    </div>
                    <p className="font-semibold text-foreground">
                      {round.distanceKm ? `${round.distanceKm} km` : '--'}
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {round.fuelConsumption > 0 && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Fuel className="w-4 h-4 text-tactical-blue" />
                      <span className="text-muted-foreground">Consumo:</span>
                      <span className="font-medium text-foreground">{round.fuelConsumption.toFixed(1)}L</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <RouteIcon className="w-4 h-4 text-tactical-green" />
                    <span className="text-muted-foreground">Pontos:</span>
                    <span className="font-medium text-foreground">{round.routePoints.length}</span>
                  </div>
                </div>

                {/* Vehicle Info */}
                {round.vehicles && (
                  <div className="p-3 bg-muted/30 rounded-lg mb-4 flex items-center space-x-3">
                    <div className="w-10 h-10 bg-tactical-blue/10 rounded-lg flex items-center justify-center">
                      <Car className="w-5 h-5 text-tactical-blue" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{round.vehicles.license_plate}</p>
                      <p className="text-sm text-muted-foreground">
                        {round.vehicles.brand} {round.vehicles.model}
                      </p>
                    </div>
                    {round.initial_odometer && round.final_odometer && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Odômetro</p>
                        <p className="text-sm font-medium text-foreground">
                          {round.initial_odometer} → {round.final_odometer} km
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mini Map */}
                {round.routePoints.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center space-x-2">
                      <MapPin className="w-3 h-3" />
                      <span>Trajeto percorrido</span>
                    </div>
                    <div 
                      id={`map-${round.id}`}
                      className="w-full h-48 rounded-lg overflow-hidden border"
                      onLoad={() => initializeMiniMap(round.id, round.routePoints)}
                    />
                  </div>
                )}

                {/* Incidents */}
                {round.incidents.length > 0 && (
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRound(
                        expandedRound === round.id ? null : round.id
                      )}
                      className="p-0 h-auto font-medium text-tactical-red hover:text-tactical-red/80"
                    >
                      {expandedRound === round.id ? 'Ocultar' : 'Ver'} incidentes ({round.incidents.length})
                    </Button>
                    
                    {expandedRound === round.id && (
                      <div className="space-y-2 mt-2 pl-4 border-l-2 border-tactical-red/20">
                        {round.incidents.map((incident) => (
                          <div key={incident.id} className="p-2 bg-tactical-red/5 rounded">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{incident.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {incident.priority}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(incident.reported_at)} • {incident.type}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" className="flex-1">
                    Ver Detalhes
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Relatório PDF
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Analisar Rota
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TacticHistoryEnhanced;
