import { useState, useEffect, useRef } from "react";
import { Navigation, User, X, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CheckpointNotification from "./CheckpointNotification";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useSecureMapbox } from "@/hooks/useSecureMapbox";
import { useEmergencyAlert } from "@/hooks/useEmergencyAlert";
import "./EmergencyMapStyles.css";

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
    vehicle: 'car' | 'motorcycle';
    template_id?: string;
  };
}

interface RoundCheckpoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  visited: boolean;
  round_id: string;
  client_id: string;
  order_index: number;
}

interface EmergencyIncident {
  id: string;
  round_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  reported_at: string;
}

const RealtimeMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarkers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [roundCheckpoints, setRoundCheckpoints] = useState<RoundCheckpoint[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyIncident[]>([]);
  const clientMarkers = useRef<mapboxgl.Marker[]>([]);
  const checkpointMarkers = useRef<mapboxgl.Marker[]>([]);
  const { toast } = useToast();
  const { token: mapboxToken } = useSecureMapbox();
  const { hasActiveAlert, isPlaying } = useEmergencyAlert(activeEmergencies);

  useEffect(() => {
    if (mapboxToken) {
      initializeMap();
      const unsubscribe = subscribeToUserLocations();
      const unsubscribeCheckpoints = subscribeToCheckpointVisits();
      const unsubscribeEmergencies = subscribeToEmergencies();
      fetchClients();

      return () => {
        unsubscribe();
        unsubscribeCheckpoints();
        unsubscribeEmergencies();
      };
    }
  }, [mapboxToken]);

  useEffect(() => {
    if (map.current) {
      updateUserLocations();
    }
  }, [userLocations]);

  useEffect(() => {
    if (map.current) {
      updateRoundCheckpoints();
    }
  }, [roundCheckpoints]);

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-48.3336, -10.1849], // Palmas - TO coordinates
        zoom: 12,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Add error handler
      map.current.on('error', (e) => {
        console.warn('Mapbox error:', e);
      });
      
      // Load client markers after map is loaded
      map.current.on('load', () => {
        fetchClients();
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      toast({
        title: "Erro",
        description: "Erro ao inicializar mapa",
        variant: "destructive",
      });
    }
  };

  const fetchClients = async () => {
    try {
      const { data: clientData, error } = await supabase
        .from("clients")
        .select("*")
        .eq("active", true)
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (error) throw error;

      if (clientData) {
        setClients(clientData);
        addClientMarkers(clientData);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const addClientMarkers = (clientData: any[]) => {
    if (!map.current || !map.current.getContainer()) return;

    // Clear existing client markers
    clientMarkers.current.forEach(marker => {
      if (marker) {
        try {
          marker.remove();
        } catch (e) {
          console.warn('Error removing client marker:', e);
        }
      }
    });
    clientMarkers.current = [];

    clientData.forEach(client => {
      if (client.lat && client.lng) {
        // Create client marker
        const el = document.createElement('div');
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = 'hsl(var(--tactical-blue))';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        // Create label for client
        const labelEl = document.createElement('div');
        labelEl.style.cssText = `
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          pointer-events: none;
          transform: translate(-50%, -100%);
          margin-bottom: 5px;
        `;
        labelEl.textContent = client.name;

        const labelMarker = new mapboxgl.Marker(labelEl, { anchor: 'bottom' })
          .setLngLat([client.lng, client.lat])
          .addTo(map.current!);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([client.lng, client.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 10px;">
                <h3 style="margin: 0 0 5px 0; font-weight: 600;">${client.name}</h3>
                <p style="margin: 0; font-size: 12px;">${client.address}</p>
                <p style="margin: 5px 0 0 0; font-size: 11px; opacity: 0.8;">
                  ${client.lat.toFixed(4)}, ${client.lng.toFixed(4)}
                </p>
              </div>
            `)
          )
          .addTo(map.current!);

        clientMarkers.current.push(marker, labelMarker);
      }
    });
  };

  const subscribeToUserLocations = () => {
    const channel = supabase
      .channel('user-locations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_locations',
        filter: 'is_active=eq.true'
      }, () => {
        fetchUserLocations();
      })
      .subscribe();

    fetchUserLocations();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchUserLocations = async () => {
    try {
      // First get locations without the problematic join
      const { data: locationData, error: locationError } = await supabase
        .from("user_locations")
        .select("*")
        .eq("is_active", true)
        .order("recorded_at", { ascending: false });

      if (locationError) throw locationError;

      if (!locationData || locationData.length === 0) {
        setUserLocations([]);
        return;
      }

      // Get unique user_ids with active rounds
      const userIds = [...new Set(locationData.map(l => l.user_id))];
      
      // Get active rounds for these users
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("id, user_id, vehicle, status, template_id")
        .in("user_id", userIds)
        .eq("status", "active");

      if (roundsError) throw roundsError;

      // Get profiles for user names
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Group by user_id and get latest location for each user with active rounds
      const latestLocations = locationData.reduce((acc: UserLocation[], location: any) => {
        const activeRound = roundsData?.find(r => r.user_id === location.user_id);
        const profile = profilesData?.find(p => p.user_id === location.user_id);
        
        if (activeRound) {
          const existingIndex = acc.findIndex(l => l.user_id === location.user_id);
          const locationWithData = {
            ...location,
            rounds: { 
              id: activeRound.id,
              vehicle: activeRound.vehicle, 
              status: activeRound.status,
              template_id: activeRound.template_id
            },
            profiles: { name: profile?.name || 'Tático' }
          };
          
          if (existingIndex === -1) {
            acc.push(locationWithData);
          } else if (new Date(location.recorded_at) > new Date(acc[existingIndex].recorded_at)) {
            acc[existingIndex] = locationWithData;
          }
        }
        return acc;
      }, []);

      setUserLocations(latestLocations);
      
      // Fetch round checkpoints for active rounds
      if (roundsData && roundsData.length > 0) {
        fetchRoundCheckpoints(roundsData);
      } else {
        setRoundCheckpoints([]);
      }
    } catch (error) {
      console.error("Error fetching user locations:", error);
    }
  };

  const updateUserLocations = () => {
    if (!map.current || !map.current.getContainer()) return;

    // Remove existing markers
    Object.values(userMarkers.current).forEach(marker => {
      if (marker) {
        try {
          marker.remove();
        } catch (e) {
          console.warn('Error removing user marker:', e);
        }
      }
    });
    userMarkers.current = {};

    // Add new markers for tactical users
    userLocations.forEach((location) => {
      // Get vehicle type icon
      const vehicleIcon = location.rounds?.vehicle === 'motorcycle' ? '🏍️' : '🚗';
      
      // Check if this user has an active emergency
      const hasActiveEmergency = activeEmergencies.some(emergency => 
        emergency.round_id === location.rounds?.id && 
        emergency.status === 'open' &&
        (emergency.priority === 'medium' || emergency.priority === 'high' || emergency.priority === 'critical')
      );
      
      const el = document.createElement('div');
      el.className = hasActiveEmergency ? 'user-marker emergency-critical' : 'user-marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = hasActiveEmergency ? 'hsl(var(--tactical-red))' : 'hsl(var(--tactical-green))';
      el.style.border = hasActiveEmergency ? '4px solid #fff' : '3px solid white';
      el.style.boxShadow = hasActiveEmergency ? 
        '0 0 25px hsl(var(--tactical-red) / 0.8), 0 0 50px hsl(var(--tactical-red) / 0.6)' : 
        '0 2px 15px rgba(0,0,0,0.4)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '20px';
      el.style.position = 'relative';
      el.style.zIndex = hasActiveEmergency ? '1000' : '100';
      el.textContent = vehicleIcon;
      
      // Add multiple pulsing ring effects for emergencies
      if (hasActiveEmergency) {
        // First ring - fast pulse
        const ring1 = document.createElement('div');
        ring1.className = 'emergency-ring-1';
        ring1.style.position = 'absolute';
        ring1.style.top = '-8px';
        ring1.style.left = '-8px';
        ring1.style.width = '56px';
        ring1.style.height = '56px';
        ring1.style.borderRadius = '50%';
        ring1.style.border = '3px solid hsl(var(--tactical-red))';
        ring1.style.animation = 'emergency-ring-fast 1s infinite ease-out';
        ring1.style.pointerEvents = 'none';
        el.appendChild(ring1);

        // Second ring - slower pulse
        const ring2 = document.createElement('div');
        ring2.className = 'emergency-ring-2';
        ring2.style.position = 'absolute';
        ring2.style.top = '-12px';
        ring2.style.left = '-12px';
        ring2.style.width = '64px';
        ring2.style.height = '64px';
        ring2.style.borderRadius = '50%';
        ring2.style.border = '2px solid hsl(var(--tactical-red))';
        ring2.style.animation = 'emergency-ring-slow 1.8s infinite ease-out';
        ring2.style.animationDelay = '0.3s';
        ring2.style.pointerEvents = 'none';
        el.appendChild(ring2);

        // Emergency badge indicator
        const emergencyBadge = document.createElement('div');
        emergencyBadge.style.position = 'absolute';
        emergencyBadge.style.top = '-5px';
        emergencyBadge.style.right = '-5px';
        emergencyBadge.style.width = '16px';
        emergencyBadge.style.height = '16px';
        emergencyBadge.style.borderRadius = '50%';
        emergencyBadge.style.backgroundColor = '#ff0000';
        emergencyBadge.style.color = 'white';
        emergencyBadge.style.fontSize = '10px';
        emergencyBadge.style.display = 'flex';
        emergencyBadge.style.alignItems = 'center';
        emergencyBadge.style.justifyContent = 'center';
        emergencyBadge.style.animation = 'emergency-badge-blink 0.8s infinite';
        emergencyBadge.style.fontWeight = 'bold';
        emergencyBadge.textContent = '!';
        el.appendChild(emergencyBadge);
      }

      // Create emergency alert overlay that appears directly on the map
      if (hasActiveEmergency) {
        const emergencyDetails = activeEmergencies.find(emergency => 
          emergency.round_id === location.rounds?.id && 
          emergency.status === 'open' &&
          (emergency.priority === 'medium' || emergency.priority === 'high' || emergency.priority === 'critical')
        );

        // Add a floating emergency alert popup
        const alertPopup = document.createElement('div');
        alertPopup.className = 'emergency-alert-popup';
        alertPopup.style.cssText = `
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #dc2626, #ef4444);
          color: white;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 8px 25px rgba(220, 38, 38, 0.4), 0 0 0 3px rgba(255, 255, 255, 0.8);
          animation: emergency-bounce 2s infinite ease-in-out;
          z-index: 1001;
          border: 2px solid white;
          min-width: 200px;
          text-align: center;
        `;
        alertPopup.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span style="font-size: 14px; animation: emergency-blink 0.8s infinite;">🚨</span>
            <span>EMERGÊNCIA ATIVA</span>
            <span style="font-size: 14px; animation: emergency-blink 0.8s infinite;">🚨</span>
          </div>
          <div style="font-size: 10px; margin-top: 4px; opacity: 0.9;">
            ${location.profiles?.name || 'Tático'} - ${emergencyDetails?.priority?.toUpperCase() || 'ALTA'}
          </div>
        `;
        el.appendChild(alertPopup);
      }

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 12px; ${hasActiveEmergency ? 'border: 3px solid #dc2626; background: linear-gradient(135deg, #fef2f2, #ffffff);' : ''}">
              <h3 style="margin: 0 0 8px 0; ${hasActiveEmergency ? 'color: #dc2626; font-weight: bold; font-size: 16px;' : 'font-weight: 600;'}">${hasActiveEmergency ? '🚨 ' : ''}${location.profiles?.name || 'Tático'} ${location.rounds?.vehicle === 'motorcycle' ? '(Moto)' : '(Carro)'}</h3>
              ${hasActiveEmergency ? `
                <div style="background: #dc2626; color: white; padding: 6px 8px; border-radius: 6px; margin: 0 0 8px 0; font-weight: bold; font-size: 13px; text-align: center;">
                  🚨 SITUAÇÃO DE EMERGÊNCIA ATIVA 🚨
                </div>
                <p style="margin: 0 0 6px 0; color: #dc2626; font-weight: bold; font-size: 12px;">
                  Prioridade: ${activeEmergencies.find(e => e.round_id === location.rounds?.id)?.priority?.toUpperCase() || 'ALTA'}
                </p>
              ` : ''}
              <p style="margin: 0 0 4px 0; font-size: 12px;">
                📅 ${new Date(location.recorded_at).toLocaleString('pt-BR')}
              </p>
              <p style="margin: 0; font-size: 11px; color: #666;">
                📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
              </p>
              ${hasActiveEmergency ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #dc2626;">
                  <button onclick="window.open('https://maps.google.com?q=${location.lat},${location.lng}', '_blank')" 
                    style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">
                    🗺️ Ver no Google Maps
                  </button>
                </div>
              ` : ''}
            </div>
          `)
        )
        .addTo(map.current!);

      userMarkers.current[location.user_id] = marker;
    });

    // Fit bounds if locations exist, but only on initial load
    if (userLocations.length > 0 && !map.current?.isMoving() && !map.current?.isZooming()) {
      const currentZoom = map.current?.getZoom() || 12;
      
      // Only auto-fit if zoom is at default level (12) to avoid interrupting user navigation
      if (currentZoom <= 12.5) {
        const bounds = new mapboxgl.LngLatBounds();
        userLocations.forEach(location => {
          bounds.extend([location.lng, location.lat]);
        });

        if (!bounds.isEmpty()) {
          map.current!.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        }
      }
    }
  };

  const expandMap = () => {
    if (map.current) {
      map.current.fitBounds(new mapboxgl.LngLatBounds([-48.5, -10.4], [-48.1, -9.9]), { padding: 50 });
    }
  };

  const subscribeToCheckpointVisits = () => {
    const channel = supabase
      .channel('checkpoint-visits-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkpoint_visits'
      }, () => {
        // Refetch locations which will also update checkpoints
        fetchUserLocations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToEmergencies = () => {
    const channel = supabase
      .channel('emergency-incidents-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents'
      }, () => {
        fetchActiveEmergencies();
      })
      .subscribe();

    fetchActiveEmergencies();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchActiveEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select("id, round_id, priority, status, reported_at")
        .eq("status", "open")
        .in("priority", ["medium", "high", "critical"]);

      if (error) throw error;

      setActiveEmergencies(data || []);
      
      // Log for debugging
      console.log("Active emergencies:", data);
    } catch (error) {
      console.error("Error fetching active emergencies:", error);
    }
  };

  const fetchRoundCheckpoints = async (activeRounds: any[]) => {
    try {
      const roundIds = activeRounds.map(r => r.id);
      const templateIds = activeRounds.filter(r => r.template_id).map(r => r.template_id);
      
      if (templateIds.length === 0) {
        setRoundCheckpoints([]);
        return;
      }

      // Get checkpoints from templates
      const { data: templateCheckpoints, error: templateError } = await supabase
        .from("round_template_checkpoints")
        .select(`
          *,
          clients (id, name, address, lat, lng)
        `)
        .in("template_id", templateIds)
        .order("order_index");

      if (templateError) throw templateError;

      // Get checkpoint visits for these rounds
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("checkpoint_id, round_id")
        .in("round_id", roundIds);

      if (visitsError) throw visitsError;

      // Get checkpoints data to map client_ids from checkpoint visits  
      const visitedCheckpointIds = visits?.map(v => v.checkpoint_id) || [];
      const { data: checkpoints, error: checkpointsError } = await supabase
        .from("checkpoints")
        .select("id, client_id, name")
        .in("id", visitedCheckpointIds);

      if (checkpointsError) throw checkpointsError;

      // Create a map of client_id -> visited status from completed visits
      const visitedByClient = new Set<string>();
      checkpoints?.forEach(checkpoint => {
        const visit = visits?.find(v => v.checkpoint_id === checkpoint.id);
        if (visit) {
          visitedByClient.add(checkpoint.client_id);
        }
      });

      // Format checkpoints with visit status
      const formattedCheckpoints: RoundCheckpoint[] = [];
      
      templateCheckpoints?.forEach(tc => {
        if (tc.clients?.lat && tc.clients?.lng) {
          const activeRound = activeRounds.find(r => r.template_id === tc.template_id);
          if (activeRound) {
            const checkpointId = `template_${tc.id}`;
            const isVisited = visitedByClient.has(tc.client_id);
            formattedCheckpoints.push({
              id: checkpointId,
              name: tc.clients.name,
              lat: tc.clients.lat,
              lng: tc.clients.lng,
              visited: isVisited,
              round_id: activeRound.id,
              client_id: tc.client_id,
              order_index: tc.order_index
            });
          }
        }
      });

      setRoundCheckpoints(formattedCheckpoints);
    } catch (error) {
      console.error("Error fetching round checkpoints:", error);
      setRoundCheckpoints([]);
    }
  };

  const updateRoundCheckpoints = () => {
    if (!map.current || !map.current.getContainer()) return;

    // Remove existing checkpoint markers
    checkpointMarkers.current.forEach(marker => {
      if (marker) {
        try {
          marker.remove();
        } catch (e) {
          console.warn('Error removing checkpoint marker:', e);
        }
      }
    });
    checkpointMarkers.current = [];

    // Add checkpoint markers
    roundCheckpoints.forEach(checkpoint => {
      // Create checkpoint marker
      const el = document.createElement('div');
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = checkpoint.visited ? 'hsl(var(--tactical-green))' : 'hsl(var(--tactical-red))';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontSize = '10px';
      el.style.fontWeight = 'bold';
      el.textContent = checkpoint.order_index.toString();

      // Create label for checkpoint
      const labelEl = document.createElement('div');
      labelEl.style.cssText = `
        background: ${checkpoint.visited ? 'hsl(var(--tactical-green))' : 'hsl(var(--tactical-red))'};
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        pointer-events: none;
        transform: translate(-50%, -100%);
        margin-bottom: 5px;
      `;
      labelEl.textContent = checkpoint.name;

      const labelMarker = new mapboxgl.Marker(labelEl, { anchor: 'bottom' })
        .setLngLat([checkpoint.lng, checkpoint.lat])
        .addTo(map.current!);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([checkpoint.lng, checkpoint.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 10px;">
              <h3 style="margin: 0 0 5px 0; font-weight: 600;">${checkpoint.name}</h3>
              <p style="margin: 0; font-size: 12px; color: ${checkpoint.visited ? '#10b981' : '#ef4444'};">
                Status: ${checkpoint.visited ? 'Visitado ✓' : 'Pendente ⏳'}
              </p>
              <p style="margin: 5px 0 0 0; font-size: 11px; opacity: 0.8;">
                Ordem: ${checkpoint.order_index}
              </p>
            </div>
          `)
        )
        .addTo(map.current!);

      checkpointMarkers.current.push(marker, labelMarker);
    });
  };

  const refreshMap = () => {
    fetchUserLocations();
    fetchClients();
  };

  return (
    <Card className="tactical-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Navigation className="w-5 h-5" />
            <span>Mapa em Tempo Real</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              {clients.length} clientes • {userLocations.length} táticos • {roundCheckpoints.length} pontos de ronda
            </Badge>
            {hasActiveAlert && (
              <Badge variant="destructive" className="animate-pulse">
                🚨 {activeEmergencies.length} EMERGÊNCIA(S) ATIVA(S) • ÁUDIO: {isPlaying ? 'ATIVO' : 'INATIVO'}
              </Badge>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                const mapElement = document.getElementById('realtime-map');
                if (mapElement) {
                  if (mapElement.requestFullscreen) {
                    mapElement.requestFullscreen();
                  }
                }
              }}
            >
              Tela Cheia
            </Button>
            <Button size="sm" variant="outline" onClick={refreshMap}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div id="realtime-map" ref={mapContainer} className="w-full h-[500px] rounded-lg relative">
          {/* Full screen controls overlay */}
          <div className="fullscreen-controls absolute top-4 right-4 z-50 hidden bg-background/90 backdrop-blur-sm p-2 rounded-lg border">
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={refreshMap}
                className="bg-background/50"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Atualizar
              </Button>
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => {
                  if (document.exitFullscreen) {
                    document.exitFullscreen();
                  }
                }}
                className="bg-background/50"
              >
                <X className="w-4 h-4 mr-1" />
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Checkpoint Notifications */}
      <CheckpointNotification enabled={true} />
    </Card>
  );
};

export default RealtimeMap;