import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Printer, Mail, MapPin, Clock, Route, Gauge, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSecureMapbox } from '@/hooks/useSecureMapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface RoundCompletionReportProps {
  open: boolean;
  onClose: () => void;
  roundId: string;
}

interface RoundData {
  id: string;
  start_time: string;
  end_time: string;
  initial_odometer: number;
  final_odometer: number;
  vehicle?: { license_plate: string; model: string; brand: string };
  profiles?: { name: string };
  template?: { name: string };
}

interface CheckpointVisit {
  visit_time: string;
  checkpoints?: { name: string };
  clients?: { name: string };
}

interface Incident {
  title: string;
  type: string;
  priority: string;
  reported_at: string;
}

interface RoutePoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

const RoundCompletionReport = ({ open, onClose, roundId }: RoundCompletionReportProps) => {
  const [loading, setLoading] = useState(true);
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [checkpointVisits, setCheckpointVisits] = useState<CheckpointVisit[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { token: mapboxToken } = useSecureMapbox();
  const { toast } = useToast();

  useEffect(() => {
    if (open && roundId) {
      fetchRoundData();
    }
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [open, roundId]);

  const fetchRoundData = async () => {
    setLoading(true);
    
    try {
      // Fetch round data
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select(`
          *,
          vehicle:vehicle_id(license_plate, model, brand),
          profiles:user_id(name),
          template:template_id(name)
        `)
        .eq('id', roundId)
        .single();

      if (roundError) throw roundError;
      setRoundData(round as any);

      // Fetch checkpoint visits
      const { data: visits, error: visitsError } = await supabase
        .from('checkpoint_visits')
        .select(`
          visit_time,
          checkpoints:checkpoint_id(name),
          clients:checkpoint_id(clients(name))
        `)
        .eq('round_id', roundId)
        .order('visit_time');

      if (visitsError) throw visitsError;
      setCheckpointVisits(visits as any);

      // Fetch incidents
      const { data: incidentData, error: incidentsError } = await supabase
        .from('incidents')
        .select('title, type, priority, reported_at')
        .eq('round_id', roundId)
        .order('reported_at');

      if (incidentsError) throw incidentsError;
      setIncidents(incidentData || []);

      // Fetch route points
      const { data: points, error: pointsError } = await supabase
        .from('route_points')
        .select('lat, lng, recorded_at')
        .eq('round_id', roundId)
        .order('recorded_at');

      if (pointsError) throw pointsError;
      setRoutePoints(points || []);

      // Initialize map with route if we have points
      if (points && points.length > 0 && mapboxToken) {
        setTimeout(() => initializeMap(points), 500);
      }
    } catch (error) {
      console.error('Error fetching round data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da ronda",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = (points: RoutePoint[]) => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate bounds
    const bounds = new mapboxgl.LngLatBounds();
    points.forEach(point => {
      bounds.extend([Number(point.lng), Number(point.lat)]);
    });

    const center = bounds.getCenter();

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [center.lng, center.lat],
      zoom: 12
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      if (!map.current) return;

      // Add route line
      const routeCoordinates = points.map(p => [Number(p.lng), Number(p.lat)]);
      
      map.current.addSource('route-trace', {
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
        id: 'route-trace',
        type: 'line',
        source: 'route-trace',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ef4444',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      // Add start marker (green)
      const startPoint = points[0];
      const startEl = document.createElement('div');
      startEl.style.width = '30px';
      startEl.style.height = '30px';
      startEl.style.borderRadius = '50%';
      startEl.style.backgroundColor = '#16a34a';
      startEl.style.border = '3px solid white';
      startEl.style.boxShadow = '0 2px 10px rgba(22, 163, 74, 0.5)';
      startEl.style.display = 'flex';
      startEl.style.alignItems = 'center';
      startEl.style.justifyContent = 'center';
      startEl.style.fontSize = '16px';
      startEl.textContent = '🏁';

      new mapboxgl.Marker({ element: startEl })
        .setLngLat([Number(startPoint.lng), Number(startPoint.lat)])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>🏁 INÍCIO</strong>'))
        .addTo(map.current);

      // Add end marker (red)
      const endPoint = points[points.length - 1];
      const endEl = document.createElement('div');
      endEl.style.width = '30px';
      endEl.style.height = '30px';
      endEl.style.borderRadius = '50%';
      endEl.style.backgroundColor = '#dc2626';
      endEl.style.border = '3px solid white';
      endEl.style.boxShadow = '0 2px 10px rgba(220, 38, 38, 0.5)';
      endEl.style.display = 'flex';
      endEl.style.alignItems = 'center';
      endEl.style.justifyContent = 'center';
      endEl.style.fontSize = '16px';
      endEl.textContent = '🏁';

      new mapboxgl.Marker({ element: endEl })
        .setLngLat([Number(endPoint.lng), Number(endPoint.lat)])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>🏁 FIM</strong>'))
        .addTo(map.current);

      // Fit to bounds
      map.current.fitBounds(bounds, { padding: 50 });
    });
  };

  const calculateDuration = () => {
    if (!roundData?.start_time || !roundData?.end_time) return 'N/A';
    
    const start = new Date(roundData.start_time);
    const end = new Date(roundData.end_time);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}min`;
  };

  const calculateDistance = () => {
    if (!roundData?.initial_odometer || !roundData?.final_odometer) return 'N/A';
    return `${roundData.final_odometer - roundData.initial_odometer} km`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    toast({
      title: "Em Desenvolvimento",
      description: "Funcionalidade de download em PDF será implementada em breve",
    });
  };

  const handleSendEmail = () => {
    toast({
      title: "Em Desenvolvimento",
      description: "Funcionalidade de envio por e-mail será implementada em breve",
    });
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileText className="w-12 h-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
              <p>Gerando relatório...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatório de Ronda Concluída
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleSendEmail}>
                <Mail className="w-4 h-4 mr-2" />
                E-mail
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 print:space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Duração</span>
                </div>
                <p className="text-2xl font-bold">{calculateDuration()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Route className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Distância</span>
                </div>
                <p className="text-2xl font-bold">{calculateDistance()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Checkpoints</span>
                </div>
                <p className="text-2xl font-bold">{checkpointVisits.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Incidentes</span>
                </div>
                <p className="text-2xl font-bold">{incidents.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Map */}
          {routePoints.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Trajeto Percorrido (GPS)
                </h3>
                <div ref={mapContainer} className="w-full h-[400px] rounded-lg overflow-hidden" />
                <p className="text-xs text-muted-foreground mt-2">
                  🔴 Linha vermelha: trajeto real percorrido durante a ronda | 🟢 Início | 🔴 Fim
                </p>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Informações da Ronda</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tático</p>
                    <p className="font-medium">{roundData?.profiles?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Template</p>
                    <p className="font-medium">{roundData?.template?.name || 'Ronda Avulsa'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Veículo</p>
                    <p className="font-medium">
                      {roundData?.vehicle 
                        ? `${roundData.vehicle.brand} ${roundData.vehicle.model} - ${roundData.vehicle.license_plate}`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Odômetro</p>
                    <p className="font-medium">
                      {roundData?.initial_odometer} km → {roundData?.final_odometer} km
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Checkpoints Visited */}
              <div>
                <h3 className="font-semibold mb-3">Checkpoints Visitados ({checkpointVisits.length})</h3>
                <div className="space-y-2">
                  {checkpointVisits.map((visit, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{index + 1}</Badge>
                        <span className="text-sm">{visit.checkpoints?.name || 'N/A'}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(visit.visit_time).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Incidents */}
              {incidents.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Incidentes Registrados ({incidents.length})</h3>
                    <div className="space-y-2">
                      {incidents.map((incident, index) => (
                        <div key={index} className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{incident.title}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{incident.type}</Badge>
                                <Badge variant="destructive" className="text-xs">{incident.priority}</Badge>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(incident.reported_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoundCompletionReport;
