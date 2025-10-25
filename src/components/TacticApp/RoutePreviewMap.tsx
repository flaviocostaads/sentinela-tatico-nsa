import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, X, Navigation, MapPin, Clock, Route as RouteIcon, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSecureMapbox } from '@/hooks/useSecureMapbox';
import { useBaseLocation } from '@/hooks/useBaseLocation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface RoutePreviewMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName?: string;
}

interface Checkpoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  address?: string;
}

const RoutePreviewMap = ({ open, onOpenChange, templateId, templateName }: RoutePreviewMapProps) => {
  const [loading, setLoading] = useState(true);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [routeData, setRouteData] = useState<any>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { token: mapboxToken } = useSecureMapbox();
  const { base, loading: baseLoading } = useBaseLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (open && templateId && mapboxToken && !baseLoading) {
      fetchCheckpoints();
    }
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [open, templateId, mapboxToken, baseLoading]);

  const getUserLocation = () => {
    // Função removida - agora usa base fixa do banco
  };

  const fetchCheckpoints = async () => {
    setLoading(true);
    try {
      // Buscar checkpoints do template
      const { data: templateCheckpoints, error: tcError } = await supabase
        .from('round_template_checkpoints')
        .select('client_id, order_index')
        .eq('template_id', templateId)
        .order('order_index');

      if (tcError) throw tcError;

      if (!templateCheckpoints || templateCheckpoints.length === 0) {
        toast({
          title: "Sem Checkpoints",
          description: "Este template não possui checkpoints configurados",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Buscar dados dos clientes
      const clientIds = templateCheckpoints.map(tc => tc.client_id);
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, name, address, lat, lng')
        .in('id', clientIds);

      if (clientError) throw clientError;

      // Buscar checkpoints físicos
      const { data: physicalCheckpoints, error: cpError } = await supabase
        .from('checkpoints')
        .select('id, name, client_id, lat, lng')
        .in('client_id', clientIds)
        .eq('active', true);

      if (cpError) throw cpError;

      // Construir lista de checkpoints
      const checkpointsList: Checkpoint[] = [];
      
      templateCheckpoints.forEach((tc, index) => {
        const client = clients?.find(c => c.id === tc.client_id);
        const clientPhysicalCp = physicalCheckpoints?.filter(cp => cp.client_id === tc.client_id) || [];
        
        if (clientPhysicalCp.length > 0) {
          clientPhysicalCp.forEach(cp => {
            const lat = cp.lat || client?.lat;
            const lng = cp.lng || client?.lng;
            
            if (lat && lng) {
              checkpointsList.push({
                id: cp.id,
                name: cp.name,
                lat: Number(lat),
                lng: Number(lng),
                order: index + 1,
                address: client?.address
              });
            }
          });
        } else if (client?.lat && client?.lng) {
          checkpointsList.push({
            id: `virtual_${tc.client_id}`,
            name: client.name,
            lat: Number(client.lat),
            lng: Number(client.lng),
            order: index + 1,
            address: client.address
          });
        }
      });

      setCheckpoints(checkpointsList);
      
      if (checkpointsList.length >= 2 && mapboxToken) {
        await calculateAndDisplayRoute(checkpointsList);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching checkpoints:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar checkpoints do template",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const calculateAndDisplayRoute = async (cps: Checkpoint[]) => {
    try {
      if (!base) {
        toast({
          title: "Base Não Configurada",
          description: "Configure um cliente como BASE para calcular rotas precisas",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Rota: BASE → Checkpoints → BASE
      const waypoints = [
        { lng: base.lng, lat: base.lat }, // 🏠 Início (BASE)
        ...cps.map(cp => ({ lng: cp.lng, lat: cp.lat })), // 🏢 Checkpoints
        { lng: base.lng, lat: base.lat } // 🏠 Retorno (BASE)
      ];

      const coordinates = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
      
      // Calcular rota usando Mapbox Directions API
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&steps=true&access_token=${mapboxToken}`;
      
      const response = await fetch(directionsUrl);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRouteData({
          distance: (route.distance / 1000).toFixed(2), // km
          duration: Math.round(route.duration / 60), // minutos
          geometry: route.geometry
        });
        
        // Inicializar mapa
        initializeMap(route.geometry, cps);
      } else {
        throw new Error('Nenhuma rota encontrada');
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      toast({
        title: "Erro ao Calcular Rota",
        description: "Não foi possível calcular a rota entre os pontos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = (routeGeometry: any, cps: Checkpoint[]) => {
    if (!mapContainer.current || map.current || !base) return;

    mapboxgl.accessToken = mapboxToken;

    // Calcular centro do mapa
    const bounds = new mapboxgl.LngLatBounds();
    
    // Adicionar BASE aos bounds
    bounds.extend([base.lng, base.lat]);
    
    cps.forEach(cp => {
      bounds.extend([cp.lng, cp.lat]);
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

      // Adicionar linha da rota
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeGeometry
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
          'line-color': '#2563eb',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });

      // Adicionar marcador da BASE
      const baseEl = document.createElement('div');
      baseEl.className = 'base-marker';
      baseEl.style.cssText = `
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        z-index: 100;
      `;
      baseEl.textContent = '🏠';

      new mapboxgl.Marker({ element: baseEl })
        .setLngLat([base.lng, base.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong style="color: #667eea;">🏠 BASE</strong>
            <p style="margin: 4px 0 0 0; font-size: 12px;">${base.name}</p>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #666;">${base.address}</p>
          </div>
        `))
        .addTo(map.current);

      // Adicionar marcadores dos checkpoints
      cps.forEach((cp, index) => {
        const el = document.createElement('div');
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#3b82f6';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 10px rgba(59, 130, 246, 0.5)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'white';
        el.style.fontSize = '14px';
        el.style.fontWeight = 'bold';
        el.textContent = cp.order.toString();

        new mapboxgl.Marker({ element: el })
          .setLngLat([cp.lng, cp.lat])
          .setPopup(
            new mapboxgl.Popup({ maxWidth: '300px' }).setHTML(`
              <div style="padding: 12px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 700; color: #111827;">
                  ${cp.order}. ${cp.name}
                </h3>
                ${cp.address ? `<p style="margin: 0; font-size: 12px; color: #6b7280;">${cp.address}</p>` : ''}
              </div>
            `)
          )
          .addTo(map.current!);
      });

      // Ajustar zoom para mostrar toda a rota
      map.current.fitBounds(bounds, { padding: 80 });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Prévia do Trajeto - {templateName || 'Ronda'}
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {routeData && !loading && (
              <div className="flex gap-4 mt-3">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  {base?.name || 'BASE'}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <RouteIcon className="w-3 h-3" />
                  {routeData.distance} km (ida e volta)
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {routeData.duration} min
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {checkpoints.length} pontos
                </Badge>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Calculando trajeto...</p>
                </div>
              </div>
            ) : null}
            
            <div ref={mapContainer} className="w-full h-full" />
            
            {!loading && checkpoints.length > 0 && (
              <Card className="absolute bottom-4 left-4 right-4 p-4 bg-background/95 backdrop-blur">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Ordem dos Pontos
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {checkpoints.map((cp) => (
                    <div key={cp.id} className="text-xs flex items-start gap-2">
                      <Badge variant="secondary" className="shrink-0">{cp.order}</Badge>
                      <span className="text-muted-foreground">{cp.name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoutePreviewMap;
