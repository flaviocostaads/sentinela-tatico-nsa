import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Download, MapPin, Route, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSecureMapbox } from "@/hooks/useSecureMapbox";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface RoundHistoryMapProps {
  onBack: () => void;
}

interface RoundData {
  id: string;
  status: string;
  start_time: string;
  end_time?: string;
  clients: {
    name: string;
  };
  route_points?: Array<{
    lat: number;
    lng: number;
    recorded_at: string;
  }>;
  checkpoint_visits?: Array<{
    id: string;
    lat?: number;
    lng?: number;
    visit_time: string;
  }>;
}

const RoundHistoryMap = ({ onBack }: RoundHistoryMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useSecureMapbox();
  const { toast } = useToast();

  useEffect(() => {
    if (mapboxToken && !tokenLoading) {
      initializeMap();
      fetchRounds();
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken, tokenLoading]);

  useEffect(() => {
    if (selectedRound) {
      fetchRoundDetails(selectedRound);
    }
  }, [selectedRound]);

  useEffect(() => {
    if (map.current && roundData) {
      displayRoundOnMap();
    }
  }, [roundData]);

  const initializeMap = () => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-49.2844, -16.6867], // Goiânia
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  };

  const fetchRounds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("rounds")
        .select(`
          id,
          status,
          start_time,
          end_time,
          clients (name)
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("start_time", { ascending: false })
        .limit(20);

      if (error) throw error;
      setRounds((data || []).map(round => ({
        ...round,
        route_points: [],
        checkpoint_visits: []
      })));
    } catch (error) {
      console.error("Error fetching rounds:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de rondas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundDetails = async (roundId: string) => {
    try {
      const { data: round, error: roundError } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name)
        `)
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;

      // Fetch route points
      const { data: routePoints, error: routeError } = await supabase
        .from("route_points")
        .select("lat, lng, recorded_at")
        .eq("round_id", roundId)
        .order("recorded_at");

      if (routeError) throw routeError;

      // Fetch checkpoint visits
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("*")
        .eq("round_id", roundId);

      if (visitsError) throw visitsError;

      setRoundData({
        ...round,
        route_points: routePoints || [],
        checkpoint_visits: visits || []
      });

    } catch (error) {
      console.error("Error fetching round details:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da ronda",
        variant: "destructive",
      });
    }
  };

  const displayRoundOnMap = () => {
    if (!map.current || !roundData) return;

    // Clear existing layers and sources
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Add route line
    if (roundData.route_points.length > 0) {
      const routeCoordinates = roundData.route_points.map(point => [point.lng, point.lat]);

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates
          }
        }
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      // Add start marker
      const startPoint = roundData.route_points[0];
      const startEl = document.createElement('div');
      startEl.className = 'start-marker';
      startEl.style.width = '20px';
      startEl.style.height = '20px';
      startEl.style.borderRadius = '50%';
      startEl.style.backgroundColor = '#10b981';
      startEl.style.border = '3px solid white';
      startEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';

      new mapboxgl.Marker(startEl)
        .setLngLat([startPoint.lng, startPoint.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<div>Início da ronda</div>'))
        .addTo(map.current);

      // Add end marker
      const endPoint = roundData.route_points[roundData.route_points.length - 1];
      const endEl = document.createElement('div');
      endEl.className = 'end-marker';
      endEl.style.width = '20px';
      endEl.style.height = '20px';
      endEl.style.borderRadius = '50%';
      endEl.style.backgroundColor = '#ef4444';
      endEl.style.border = '3px solid white';
      endEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';

      new mapboxgl.Marker(endEl)
        .setLngLat([endPoint.lng, endPoint.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<div>Fim da ronda</div>'))
        .addTo(map.current);

      // Fit map to route
      const bounds = new mapboxgl.LngLatBounds();
      routeCoordinates.forEach(coord => bounds.extend([coord[0], coord[1]]));
      map.current.fitBounds(bounds, { padding: 50 });
    }

    // Add checkpoint visit markers
    roundData.checkpoint_visits.forEach((visit, index) => {
      if (visit.lat && visit.lng) {
        const el = document.createElement('div');
        el.className = 'visit-marker';
        el.style.width = '25px';
        el.style.height = '25px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#f59e0b';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'white';
        el.style.fontSize = '12px';
        el.style.fontWeight = 'bold';
        el.textContent = (index + 1).toString();

        new mapboxgl.Marker(el)
          .setLngLat([visit.lng, visit.lat])
          .setPopup(
            new mapboxgl.Popup().setHTML(`
              <div style="padding: 10px;">
                <h4>Checkpoint ${index + 1}</h4>
                <p>Visitado em: ${new Date(visit.visit_time).toLocaleString('pt-BR')}</p>
              </div>
            `)
          )
          .addTo(map.current!);
      }
    });
  };

  const downloadMapImage = async () => {
    if (!map.current) return;

    try {
      const canvas = map.current.getCanvas();
      const dataURL = canvas.toDataURL('image/png');
      
      const link = document.createElement('a');
      link.download = `mapa-ronda-${selectedRound}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataURL;
      link.click();

      toast({
        title: "Download concluído",
        description: "Imagem do mapa foi baixada com sucesso",
      });
    } catch (error) {
      console.error("Error downloading map:", error);
      toast({
        title: "Erro no download",
        description: "Erro ao baixar imagem do mapa",
        variant: "destructive",
      });
    }
  };

  const calculateDistance = () => {
    if (!roundData?.route_points?.length) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < roundData.route_points.length; i++) {
      const prev = roundData.route_points[i - 1];
      const curr = roundData.route_points[i];
      
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

  const formatDuration = () => {
    if (!roundData?.start_time || !roundData?.end_time) return "N/A";
    
    const start = new Date(roundData.start_time);
    const end = new Date(roundData.end_time);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffHours}h ${diffMinutes}m`;
  };

  if (loading || tokenLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">
            {tokenLoading ? "Carregando configuração do mapa..." : "Carregando histórico..."}
          </p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Erro ao carregar configuração do mapa</p>
          <Button onClick={onBack}>Voltar</Button>
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
              <p className="text-sm text-muted-foreground">Visualize trajetos das rondas concluídas</p>
            </div>
          </div>
          
          {selectedRound && (
            <Button onClick={downloadMapImage} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Baixar Mapa
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b">
        <div className="max-w-md">
          <Select value={selectedRound} onValueChange={setSelectedRound}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma ronda para visualizar" />
            </SelectTrigger>
            <SelectContent>
              {rounds.map((round) => (
                <SelectItem key={round.id} value={round.id}>
                  {round.clients.name} - {new Date(round.start_time).toLocaleDateString('pt-BR')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-[calc(100vh-160px)]" />
        </div>

        {/* Round Details Sidebar */}
        {roundData && (
          <div className="w-80 border-l p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhes da Ronda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                  <p className="text-sm">{roundData.clients.name}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className="ml-2">{roundData.status}</Badge>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Duração</label>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{formatDuration()}</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Distância</label>
                  <div className="flex items-center space-x-2">
                    <Route className="w-4 h-4" />
                    <span className="text-sm">{calculateDistance().toFixed(2)} km</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Checkpoints</label>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">{roundData.checkpoint_visits.length} visitados</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pontos de rota</label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{roundData.route_points.length} registrados</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Legenda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-3 bg-tactical-green rounded-full border border-white"></div>
                  <span>Início da ronda</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-3 bg-tactical-red rounded-full border border-white"></div>
                  <span>Fim da ronda</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-3 bg-tactical-amber rounded-full border border-white"></div>
                  <span>Checkpoint visitado</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-1 bg-tactical-blue"></div>
                  <span>Trajeto percorrido</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoundHistoryMap;