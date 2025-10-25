import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, MapPin, Users, Navigation, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface TacticMapEnhancedProps {
  onBack: () => void;
}

interface Client {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface UserLocation {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  profiles?: {
    name: string;
  };
  rounds?: {
    id: string;
    status: string;
  };
}

interface ActiveRound {
  id: string;
  status: string;
  user_id: string;
  profiles?: {
    name: string;
  };
  clients?: {
    name: string;
    lat: number;
    lng: number;
  };
}

const TacticMapEnhanced = ({ onBack }: TacticMapEnhancedProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [activeRounds, setActiveRounds] = useState<ActiveRound[]>([]);
  const [stats, setStats] = useState({ tactics: 0, clients: 0, emergencies: 0 });
  const { currentLocation, isTracking } = useGpsTracking({ enableRealtime: true, autoStart: true });
  const { toast } = useToast();

  const mapboxToken = 'pk.eyJ1IjoiZmxhdmlvY29zdGFhZHMiLCJhIjoiY21laHB4MzVnMGE3ZjJycHVjZnN0N3d4cCJ9.slf_UnkEO8ekt3OU1HttLA';

  useEffect(() => {
    initializeMap();
    fetchAllData();

    // Set up real-time subscriptions
    const locationsChannel = supabase
      .channel('user_locations_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_locations'
      }, () => {
        fetchUserLocations();
      })
      .subscribe();

    const roundsChannel = supabase
      .channel('rounds_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds'
      }, () => {
        fetchActiveRounds();
      })
      .subscribe();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchAllData, 30000);

    return () => {
      if (map.current) map.current.remove();
      locationsChannel.unsubscribe();
      roundsChannel.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (currentLocation && map.current) {
      updateOwnLocation(currentLocation);
    }
  }, [currentLocation]);

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-48.3336, -10.1849],
        zoom: 12,
        pitch: 0,
        bearing: 0
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );

      map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-right');
    } catch (error) {
      console.error("Error initializing map:", error);
      toast({
        title: "Erro no mapa",
        description: "Erro ao inicializar o mapa",
        variant: "destructive",
      });
    }
  };

  const fetchAllData = async () => {
    await Promise.all([
      fetchClients(),
      fetchUserLocations(),
      fetchActiveRounds()
    ]);
    updateStats();
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

  const fetchUserLocations = async () => {
    try {
      // Get recent locations from all active users
      const { data, error } = await supabase
        .from("user_locations")
        .select(`
          *,
          profiles (name),
          rounds (id, status)
        `)
        .eq("is_active", true)
        .gte("recorded_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      
      if (data) {
        // Get only the latest location per user
        const latestLocations = data.reduce((acc: UserLocation[], loc: any) => {
          if (!acc.find(l => l.user_id === loc.user_id)) {
            acc.push(loc);
          }
          return acc;
        }, []);

        setUserLocations(latestLocations);
        addUserLocationMarkersToMap(latestLocations);
      }
    } catch (error) {
      console.error("Error fetching user locations:", error);
    }
  };

  const fetchActiveRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select(`
          *,
          profiles (name),
          clients (name, lat, lng)
        `)
        .eq("status", "active")
        .order("start_time", { ascending: false });

      if (error) throw error;
      setActiveRounds(data || []);
    } catch (error) {
      console.error("Error fetching active rounds:", error);
    }
  };

  const updateStats = () => {
    setStats({
      tactics: userLocations.length,
      clients: clients.length,
      emergencies: 0 // Could fetch from incidents table
    });
  };

  const addClientMarkersToMap = (clientData: Client[]) => {
    if (!map.current) return;

    // Remove existing client markers
    const existingMarkers = document.querySelectorAll('.client-marker, .client-label');
    existingMarkers.forEach(m => m.remove());

    clientData.forEach(client => {
      const el = document.createElement('div');
      el.className = 'client-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'hsl(var(--tactical-green))';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      const icon = document.createElement('div');
      icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
      el.appendChild(icon);

      // Add label
      const labelEl = document.createElement('div');
      labelEl.className = 'client-label';
      labelEl.style.backgroundColor = 'hsl(var(--tactical-green))';
      labelEl.style.color = 'white';
      labelEl.style.padding = '4px 8px';
      labelEl.style.borderRadius = '4px';
      labelEl.style.fontSize = '11px';
      labelEl.style.fontWeight = '600';
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.pointerEvents = 'none';
      labelEl.textContent = client.name;

      new mapboxgl.Marker(labelEl, { anchor: 'bottom', offset: [0, -35] })
        .setLngLat([client.lng, client.lat])
        .addTo(map.current!);

      new mapboxgl.Marker(el)
        .setLngLat([client.lng, client.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; min-width: 150px;">
              <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 13px;">${client.name}</h3>
              <p style="margin: 0; font-size: 11px; color: #666;">${client.address}</p>
            </div>
          `)
        )
        .addTo(map.current!);
    });
  };

  const addUserLocationMarkersToMap = (locations: UserLocation[]) => {
    if (!map.current) return;

    // Remove existing user markers (except own)
    const existingMarkers = document.querySelectorAll('.tactic-marker, .tactic-label');
    existingMarkers.forEach(m => m.remove());

    locations.forEach(location => {
      const el = document.createElement('div');
      el.className = 'tactic-marker';
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'hsl(var(--tactical-blue))';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      const icon = document.createElement('div');
      icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
      el.appendChild(icon);

      // Add label with tactic name
      const labelEl = document.createElement('div');
      labelEl.className = 'tactic-label';
      labelEl.style.backgroundColor = 'hsl(var(--tactical-blue))';
      labelEl.style.color = 'white';
      labelEl.style.padding = '3px 6px';
      labelEl.style.borderRadius = '3px';
      labelEl.style.fontSize = '10px';
      labelEl.style.fontWeight = '600';
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.pointerEvents = 'none';
      labelEl.textContent = location.profiles?.name || 'Tático';

      new mapboxgl.Marker(labelEl, { anchor: 'bottom', offset: [0, -40] })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current!);

      new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; min-width: 120px;">
              <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 12px;">${location.profiles?.name || 'Tático'}</h3>
              <p style="margin: 0; font-size: 10px; color: #666;">
                Status: ${location.rounds?.[0]?.status === 'active' ? 'Em ronda' : 'Disponível'}
              </p>
              <p style="margin: 2px 0 0 0; font-size: 9px; color: #999;">
                Atualizado: ${new Date(location.recorded_at).toLocaleTimeString('pt-BR')}
              </p>
            </div>
          `)
        )
        .addTo(map.current!);
    });
  };

  const updateOwnLocation = (location: { lat: number; lng: number }) => {
    if (!map.current) return;

    // Remove existing own marker
    const existingMarker = document.querySelector('.own-location-marker');
    if (existingMarker) existingMarker.remove();

    // Add own location marker (distinctive style)
    const userMarker = document.createElement('div');
    userMarker.className = 'own-location-marker';
    userMarker.style.width = '20px';
    userMarker.style.height = '20px';
    userMarker.style.borderRadius = '50%';
    userMarker.style.backgroundColor = 'hsl(var(--tactical-amber))';
    userMarker.style.border = '4px solid white';
    userMarker.style.boxShadow = '0 0 15px rgba(0,0,0,0.4)';
    userMarker.style.animation = 'pulse 2s infinite';

    new mapboxgl.Marker(userMarker)
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);
  };

  const refreshMap = () => {
    fetchAllData();
    if (currentLocation && map.current) {
      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 14
      });
    }
    toast({
      title: "Mapa atualizado",
      description: "Dados atualizados com sucesso",
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
              </div>
            </div>
          </div>
          
          <Button onClick={refreshMap} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div ref={mapContainer} className="w-full h-[calc(100vh-100px)]" />
        
        {/* Stats Overlay - Top Left */}
        <div className="absolute top-4 left-4 space-y-2 z-10">
          <div className="flex items-center space-x-2">
            <Badge className="bg-tactical-blue text-white">
              <Users className="w-3 h-3 mr-1" />
              {stats.tactics} Táticos
            </Badge>
            <Badge className="bg-tactical-green text-white">
              <MapPin className="w-3 h-3 mr-1" />
              {stats.clients} Clientes
            </Badge>
            {stats.emergencies > 0 && (
              <Badge className="bg-tactical-red text-white animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {stats.emergencies} Emergências
              </Badge>
            )}
          </div>

          {/* GPS Status */}
          <Card className="w-64">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status GPS</span>
                <Badge className={isTracking ? 'bg-tactical-green' : 'bg-tactical-amber'}>
                  {isTracking ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {currentLocation && (
                <div className="text-xs text-muted-foreground mt-1">
                  {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Legend - Bottom Left */}
        <div className="absolute bottom-4 left-4 z-10">
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="text-xs font-semibold mb-2">Legenda</div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-4 bg-tactical-amber rounded-full border-2 border-white"></div>
                <span>Você</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-4 bg-tactical-blue rounded-full border-2 border-white"></div>
                <span>Outros táticos</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-4 bg-tactical-green rounded-full border-2 border-white"></div>
                <span>Clientes</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 15px rgba(251, 191, 36, 0.4);
          }
          50% {
            box-shadow: 0 0 25px rgba(251, 191, 36, 0.8);
          }
        }
      `}</style>
    </div>
  );
};

export default TacticMapEnhanced;
