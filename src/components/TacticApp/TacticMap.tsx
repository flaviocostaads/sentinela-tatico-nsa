import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Navigation, RefreshCw, MapPin, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface TacticMapProps {
  onBack: () => void;
}

interface RoutePoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

interface Client {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const TacticMap = ({ onBack }: TacticMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const { currentLocation, isTracking } = useGpsTracking({ enableRealtime: true, autoStart: true });
  const { toast } = useToast();

  // Token do Mapbox - usar o token já configurado
  const mapboxToken = 'pk.eyJ1IjoiZmxhdmlvY29zdGFhZHMiLCJhIjoiY21laHB4MzVnMGE3ZjJycHVjZnN0N3d4cCJ9.slf_UnkEO8ekt3OU1HttLA';

  useEffect(() => {
    initializeMap();
    fetchClients();

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (currentLocation && map.current) {
      updateMapLocation(currentLocation);
    }
  }, [currentLocation]);

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-48.3336, -10.1849], // Palmas - TO coordinates
        zoom: 12,
        pitch: 0,
        bearing: 0
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      // Add geolocate control
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );

      // Add scale control
      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    } catch (error) {
      console.error("Error initializing map:", error);
      toast({
        title: "Erro no mapa",
        description: "Erro ao inicializar o mapa",
        variant: "destructive",
      });
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, address, lat, lng")
        .eq("active", true)
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (error) throw error;
      
      if (data) {
        setClients(data);
        addClientMarkersToMap(data);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const addClientMarkersToMap = (clientData: Client[]) => {
    if (!map.current) return;

    clientData.forEach(client => {
      // Create marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMzQgMiA1IDUuMTM0IDUgOUM1IDEzLjUyNSAxMiAyMiAxMiAyMkMxMiAyMiAxOSAxMy41MjUgMTkgOUMxOSA1LjEzNCAxNS44NjYgMiAxMiAyWiIgZmlsbD0iIzM0NEU0MSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSI5IiByPSIzIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=)';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.backgroundSize = 'contain';
      el.style.cursor = 'pointer';

      // Create label element for permanent display
      const labelEl = document.createElement('div');
      labelEl.className = 'client-label';
      labelEl.style.backgroundColor = 'hsl(var(--tactical-blue))';
      labelEl.style.color = 'white';
      labelEl.style.padding = '4px 8px';
      labelEl.style.borderRadius = '4px';
      labelEl.style.fontSize = '12px';
      labelEl.style.fontWeight = '500';
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.pointerEvents = 'none';
      labelEl.textContent = client.name;

      // Add label marker
      new mapboxgl.Marker(labelEl, { anchor: 'bottom', offset: [0, -30] })
        .setLngLat([client.lng, client.lat])
        .addTo(map.current!);

      // Add main marker with popup
      new mapboxgl.Marker(el)
        .setLngLat([client.lng, client.lat])
        .setPopup(
          new mapboxgl.Popup({ 
            offset: 25,
            className: 'tactical-popup',
            closeButton: true,
            closeOnClick: false
          }).setHTML(`
            <div style="background: hsl(var(--tactical-blue)); color: white; padding: 12px; border-radius: 8px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">${client.name}</h3>
              <p style="margin: 0; font-size: 12px; opacity: 0.9;">${client.address}</p>
            </div>
          `)
        )
        .addTo(map.current!);
    });
  };


  const updateMapLocation = (location: { lat: number; lng: number }) => {
    if (!map.current) return;

    // Center map on current location
    map.current.flyTo({
      center: [location.lng, location.lat],
      zoom: 15,
      duration: 1000
    });

    // Remove existing user marker
    const existingMarker = document.querySelector('.user-location-marker');
    if (existingMarker) {
      existingMarker.remove();
    }

    // Add user location marker
    const userMarker = document.createElement('div');
    userMarker.className = 'user-location-marker';
    userMarker.style.backgroundColor = 'hsl(var(--tactical-blue))';
    userMarker.style.width = '16px';
    userMarker.style.height = '16px';
    userMarker.style.borderRadius = '50%';
    userMarker.style.border = '3px solid white';
    userMarker.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

    new mapboxgl.Marker(userMarker)
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);
  };

  const saveRoutePoint = async (location: { lat: number; lng: number }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get active round
      const { data: activeRound } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (activeRound) {
        await supabase
          .from("route_points")
          .insert([{
            round_id: activeRound.id,
            lat: location.lat,
            lng: location.lng,
            speed: 0
          }]);

        // Add to local route points
        setRoutePoints(prev => [...prev, {
          lat: location.lat,
          lng: location.lng,
          recorded_at: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error("Error saving route point:", error);
    }
  };


  const refreshMap = () => {
    fetchClients();
    if (currentLocation && map.current) {
      updateMapLocation(currentLocation);
    }
    toast({
      title: "Mapa atualizado",
      description: "Informações do mapa foram atualizadas",
    });
  };

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
              <h1 className="text-lg font-semibold">Mapa em Tempo Real</h1>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Navigation className="w-3 h-3" />
                <span>
                  {isTracking ? 'Rastreamento ativo' : 'Rastreamento inativo'}
                </span>
                {currentLocation && (
                  <Badge variant="secondary" className="text-xs">
                    GPS: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button onClick={refreshMap} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={onBack} size="sm" variant="destructive">
              <X className="w-4 h-4 mr-2" />
              Fechar Mapa
            </Button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={mapContainer} className="w-full h-[calc(100vh-120px)]" />
        
        {/* Map controls overlay */}
        <div className="absolute top-4 left-4 space-y-2 z-10">
          <Card className="w-64">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Status GPS</span>
                <Badge className={isTracking ? 'bg-tactical-green' : 'bg-tactical-amber'}>
                  {isTracking ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>Clientes: {clients.length}</span>
                <Route className="w-3 h-3 ml-2" />
                <span>Pontos: {routePoints.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legenda</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-4 bg-tactical-blue rounded-full border border-white"></div>
                <span>Sua localização</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-4 bg-tactical-green rounded-sm"></div>
                <span>Pontos de cliente</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-1 bg-tactical-amber"></div>
                <span>Trajeto percorrido</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TacticMap;