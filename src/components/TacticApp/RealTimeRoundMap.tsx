import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Navigation, User, MapPin, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { useSecureMapbox } from "@/hooks/useSecureMapbox";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface RealTimeRoundMapProps {
  roundId: string;
  onBack: () => void;
}

interface CheckpointMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  visited: boolean;
  order_index: number;
  client_id: string;
}

interface UserLocation {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
}

const RealTimeRoundMap = ({ roundId, onBack }: RealTimeRoundMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarkers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [checkpoints, setCheckpoints] = useState<CheckpointMarker[]>([]);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [roundData, setRoundData] = useState<any>(null);
  const { currentLocation, isTracking } = useGpsTracking();
  const { token: mapboxToken, loading: tokenLoading, error: tokenError } = useSecureMapbox();
  const { toast } = useToast();

  useEffect(() => {
    if (mapboxToken && !tokenLoading) {
      initializeMap();
      fetchRoundData();
      const unsubscribe = subscribeToUserLocations();
      const unsubscribeCheckpoints = subscribeToCheckpointVisits();

      return () => {
        if (unsubscribe) unsubscribe();
        if (unsubscribeCheckpoints) unsubscribeCheckpoints();
        if (map.current) {
          map.current.remove();
        }
      };
    }
  }, [roundId, mapboxToken, tokenLoading]);

  useEffect(() => {
    if (map.current && checkpoints.length > 0) {
      addCheckpointsToMap();
    }
  }, [checkpoints]);

  useEffect(() => {
    if (map.current && userLocations.length > 0) {
      updateUserLocations();
    }
  }, [userLocations]);

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

  const fetchRoundData = async () => {
    try {
      // Fetch round details
      const { data: round, error: roundError } = await supabase
        .from("rounds")
        .select(`
          *,
          clients (name, address, lat, lng)
        `)
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRoundData(round);

      // Fetch checkpoints from template if available
      if (round.template_id) {
        const { data: templateCheckpoints, error: templateError } = await supabase
          .from("round_template_checkpoints")
          .select(`
            *,
            clients (id, name, address, lat, lng)
          `)
          .eq("template_id", round.template_id)
          .order("order_index");

        if (templateError) throw templateError;

        // Get checkpoint visits
        const { data: visits, error: visitsError } = await supabase
          .from("checkpoint_visits")
          .select("checkpoint_id")
          .eq("round_id", roundId);

        if (visitsError) throw visitsError;

        const visitedIds = new Set(visits?.map(v => v.checkpoint_id) || []);
        console.log("Visited checkpoint IDs:", Array.from(visitedIds));

        const formattedCheckpoints = (templateCheckpoints || []).map(tc => {
          const checkpointId = `template_${tc.id}`;
          const clientId = `template_${tc.client_id}`;
          
          // Enhanced ID matching - check exact matches with visited checkpoint IDs
          const possibleIds = [
            checkpointId,           // template_<template_checkpoint_id>
            clientId,               // template_<client_id>
            tc.id.toString(),       // template_checkpoint_id as string
            tc.client_id.toString(), // client_id as string
            `client_${tc.client_id}`, // client_<client_id>
            `checkpoint_${tc.id}`,   // checkpoint_<template_checkpoint_id>
            tc.id,                   // template_checkpoint_id raw
            tc.client_id             // client_id raw
          ];
          
          // Check if any visit checkpoint_id exactly matches our possible IDs
          const isVisited = Array.from(visitedIds).some(visitId => {
            return possibleIds.some(possibleId => {
              const match = visitId === possibleId || visitId.toString() === possibleId.toString();
              if (match) {
                console.log("MATCH FOUND:", visitId, "matches", possibleId, "for checkpoint:", tc.clients.name);
              }
              return match;
            });
          });
          
          console.log("Checkpoint:", tc.clients.name, "Template ID:", tc.id, "Client ID:", tc.client_id, "Is Visited:", isVisited);
          
          return {
            id: checkpointId,
            name: tc.clients.name,
            lat: tc.clients.lat || 0,
            lng: tc.clients.lng || 0,
            visited: isVisited,
            order_index: tc.order_index,
            client_id: tc.client_id
          };
        });

        // Update the map in real-time when data changes
        if (map.current) {
          // Clear existing checkpoint markers
          const existingMarkers = document.querySelectorAll('.checkpoint-marker');
          existingMarkers.forEach(marker => marker.remove());
          
          addCheckpointsToMap();
        }
        
        setCheckpoints(formattedCheckpoints);
      }
    } catch (error) {
      console.error("Error fetching round data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da ronda",
        variant: "destructive",
      });
    }
  };

  const subscribeToUserLocations = () => {
    const channel = supabase
      .channel('user-locations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_locations',
        filter: `is_active=eq.true`
      }, (payload) => {
        console.log('Location update:', payload);
        fetchUserLocations();
      })
      .subscribe();

    fetchUserLocations();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToCheckpointVisits = () => {
    const channel = supabase
      .channel('checkpoint-visits-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkpoint_visits',
        filter: `round_id=eq.${roundId}`
      }, () => {
        console.log('Checkpoint visit update');
        fetchRoundData(); // Refresh round data to update checkpoint status
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchUserLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("user_locations")
        .select("*")
        .eq("is_active", true)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      setUserLocations(data || []);
    } catch (error) {
      console.error("Error fetching user locations:", error);
    }
  };

  const addCheckpointsToMap = () => {
    if (!map.current) return;

    // Clear existing checkpoint markers first
    const existingMarkers = document.querySelectorAll('.checkpoint-marker');
    existingMarkers.forEach(marker => marker.remove());

    checkpoints.forEach((checkpoint) => {
      if (checkpoint.lat && checkpoint.lng) {
        const el = document.createElement('div');
        el.className = 'checkpoint-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        el.style.backgroundColor = checkpoint.visited ? 'hsl(var(--tactical-green))' : 'hsl(var(--tactical-red))';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'white';
        el.style.fontSize = '12px';
        el.style.fontWeight = 'bold';
        el.textContent = checkpoint.order_index.toString();

        new mapboxgl.Marker(el)
          .setLngLat([checkpoint.lng, checkpoint.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 10px;">
                <h3 style="margin: 0 0 5px 0; font-size: 14px; font-weight: 600;">
                  ${checkpoint.name}
                </h3>
                <p style="margin: 0; font-size: 12px; color: ${checkpoint.visited ? '#10b981' : '#ef4444'};">
                  Status: ${checkpoint.visited ? 'Visitado ✓' : 'Pendente ⏳'}
                </p>
              </div>
            `)
          )
          .addTo(map.current!);
      }
    });

    // Fit map to show all checkpoints
    if (checkpoints.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      checkpoints.forEach(cp => {
        if (cp.lat && cp.lng) {
          bounds.extend([cp.lng, cp.lat]);
        }
      });

      map.current!.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
  };

  const updateUserLocations = () => {
    if (!map.current) return;

    // Remove existing markers
    Object.keys(userMarkers.current).forEach(userId => {
      userMarkers.current[userId].remove();
      delete userMarkers.current[userId];
    });

    // Add new markers with vehicle icons
    userLocations.forEach((location) => {
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'hsl(var(--tactical-blue))';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '14px';
      
      // Add vehicle icon based on round data
      const vehicleType = roundData?.vehicle?.toLowerCase() || 'car';
      const vehicleIcon = (vehicleType === 'motorcycle' || vehicleType === 'moto' || vehicleType === 'motocicleta') ? '🏍️' : '🚗';
      el.innerHTML = vehicleIcon;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 10px;">
              <h3 style="margin: 0 0 5px 0; font-size: 14px; font-weight: 600;">
                Tático
              </h3>
              <p style="margin: 0; font-size: 12px; color: #666;">
                Última atualização: ${new Date(location.recorded_at).toLocaleTimeString('pt-BR')}
              </p>
            </div>
          `)
        )
        .addTo(map.current!);

      userMarkers.current[location.user_id] = marker;
    });
  };

  const visitedCount = checkpoints.filter(cp => cp.visited).length;
  const progress = checkpoints.length > 0 ? (visitedCount / checkpoints.length) * 100 : 0;

  if (tokenLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando mapa...</p>
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
              <h1 className="text-lg font-semibold">Mapa da Ronda</h1>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Navigation className="w-3 h-3" />
                <span>Progresso: {visitedCount}/{checkpoints.length}</span>
                <Badge variant={isTracking ? "default" : "secondary"}>
                  GPS: {isTracking ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={mapContainer} className="w-full h-[calc(100vh-120px)]" />
        
        {/* Progress Card */}
        <div className="absolute top-4 left-4 z-10">
          <Card className="w-72">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Progresso da Ronda</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(progress)}%
                  </span>
                </div>
                
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-tactical-green h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-red rounded-full"></div>
                    <span>Pendente ({checkpoints.length - visitedCount})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-tactical-green rounded-full"></div>
                    <span>Visitado ({visitedCount})</span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>Táticos ativos: {userLocations.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 z-10">
          <Card>
            <CardContent className="p-3">
              <h4 className="text-sm font-medium mb-2">Legenda</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-tactical-red rounded-full border-2 border-white"></div>
                  <span>Checkpoint pendente</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-tactical-green rounded-full border-2 border-white"></div>
                  <span>Checkpoint visitado</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-tactical-blue rounded-full border-2 border-white"></div>
                  <span>Localização do tático</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RealTimeRoundMap;