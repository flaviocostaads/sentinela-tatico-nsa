import { useState, useEffect, useRef } from "react";
import { Navigation, User, X, RotateCcw, Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { useRealtimeMap } from "@/hooks/useRealtimeMap";
import FullscreenEmergencyAlert from "./FullscreenEmergencyAlert";
import IncidentDetailsDialog from "@/components/TacticApp/IncidentDetailsDialog";
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
    vehicle: 'car' | 'motorcycle' | 'on_foot';
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
  client_name?: string;
  client_address?: string;
  order_index: number;
}

interface EmergencyIncident {
  id: string;
  round_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  reported_at: string;
}

interface RealtimeMapProps {
  isExpanded?: boolean;
  onClose?: () => void;
  onOpenNewWindow?: () => void;
  onExpand?: () => void;
  defaultCity?: string;
}

const RealtimeMap = ({ isExpanded = false, onClose, onOpenNewWindow, onExpand, defaultCity = 'São Paulo, SP, Brasil' }: RealtimeMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarkers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [roundCheckpoints, setRoundCheckpoints] = useState<RoundCheckpoint[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedMarker, setHighlightedMarker] = useState<string | null>(null);
  const clientMarkers = useRef<mapboxgl.Marker[]>([]);
  const checkpointMarkers = useRef<mapboxgl.Marker[]>([]);
  const { toast } = useToast();
  const { token: mapboxToken } = useSecureMapbox();
  
  // Use the new realtime map hook for automatic updates
  const { 
    userLocations, 
    clients, 
    activeEmergencies, 
    lastUpdateTime, 
    isAutoUpdating,
    fetchAllData 
  } = useRealtimeMap();
  
  const { hasActiveAlert, isPlaying } = useEmergencyAlert(activeEmergencies);

  useEffect(() => {
    if (mapboxToken) {
      initializeMap();
    }
  }, [mapboxToken]);

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      
      // Show/hide fullscreen controls
      const controls = document.querySelector('.fullscreen-controls');
      if (controls) {
        if (isCurrentlyFullscreen) {
          controls.classList.remove('hidden');
        } else {
          controls.classList.add('hidden');
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Unified map update effect with debounce to prevent duplicate markers
  useEffect(() => {
    if (!map.current) return;

    console.log('🔄 Map update triggered');
    console.log('  - userLocations:', userLocations.length);
    console.log('  - clients:', clients.length);
    console.log('  - roundCheckpoints:', roundCheckpoints.length);

    // Use a longer delay to batch updates and prevent duplicates/flickering
    const updateTimer = setTimeout(() => {
      console.log('📍 Executing unified map update');
      
      // 1. Update tactical user locations (always first)
      updateUserLocations();
      
      // 2. Fetch checkpoints ONLY for active rounds
      const activeRounds = userLocations.map(loc => loc.rounds).filter(Boolean);
      if (activeRounds.length > 0) {
        fetchRoundCheckpoints(activeRounds);
      } else {
        // Clear checkpoint markers if no active rounds
        console.log('📍 No active rounds - clearing checkpoints');
        setRoundCheckpoints([]);
      }
      
      // 3. Update client markers (empresas) - SEMPRE VISÍVEIS
      updateClientMarkers();
    }, 300); // Increased debounce delay to prevent flickering

    return () => clearTimeout(updateTimer);
  }, [userLocations, clients, highlightedMarker]);

  // Separate effect for checkpoint markers only (triggered by data change)
  useEffect(() => {
    if (map.current && roundCheckpoints.length >= 0) {
      // Longer delay to ensure client markers are updated first and prevent flickering
      const timer = setTimeout(() => {
        updateRoundCheckpoints();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [roundCheckpoints]);

  // Listen for checkpoint visit changes in real-time
  useEffect(() => {
    console.log('🔄 Setting up real-time checkpoint visits subscription');
    
    const checkpointVisitsChannel = supabase
      .channel('checkpoint-visits-realtime-map')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkpoint_visits'
      }, (payload) => {
        console.log('📍 Real-time checkpoint visit change detected:', payload);
        console.log('Event type:', payload.eventType);
        console.log('New data:', payload.new);
        
        // Re-fetch checkpoints when a visit is created/updated
        if (map.current && userLocations.length > 0) {
          const activeRounds = userLocations.map(loc => loc.rounds).filter(Boolean);
          if (activeRounds.length > 0) {
            console.log('🔄 Refreshing checkpoints due to visit change for rounds:', activeRounds.map(r => r.id));
            
            // Add a small delay to ensure database has been updated
            setTimeout(() => {
              fetchRoundCheckpoints(activeRounds);
            }, 500);
          }
        }
      })
      .subscribe((status) => {
        console.log('📍 Checkpoint visits subscription status:', status);
      });

    return () => {
      console.log('🔄 Cleaning up checkpoint visits subscription');
      supabase.removeChannel(checkpointVisitsChannel);
    };
  }, [userLocations]); // Re-create subscription when userLocations change

  const initializeMap = async () => {
    if (!mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      // Geocode default city if provided
      let centerCoords: [number, number] = [-48.3336, -10.1849]; // Default: Palmas - TO
      
      if (defaultCity) {
        try {
          const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(defaultCity)}.json?access_token=${mapboxToken}&limit=1`;
          const response = await fetch(geocodeUrl);
          const data = await response.json();
          
          if (data.features && data.features.length > 0) {
            centerCoords = data.features[0].center;
            console.log(`📍 Geocoded ${defaultCity} to:`, centerCoords);
          }
        } catch (geocodeError) {
          console.warn('Error geocoding city, using default:', geocodeError);
        }
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: centerCoords,
        zoom: 12,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Add error handler
      map.current.on('error', (e) => {
        console.warn('Mapbox error:', e);
      });
      
      // Load initial data after map is loaded
      map.current.on('load', () => {
        fetchAllData();
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

  const updateClientMarkers = async () => {
    if (!map.current || !map.current.getContainer()) return;

    console.log('🏢 === UPDATING CLIENT MARKERS ===');
    console.log('🏢 Total clients to display:', clients.length);
    console.log('🏢 Current markers before clear:', clientMarkers.current.length);

    // STEP 1: Prevent duplicate updates with debouncing
    if (clientMarkers.current.length > 0 && clients.length === clientMarkers.current.length) {
      console.log('🏢 ⚠️ Skipping update - markers already up to date');
      return;
    }

    // STEP 2: CLEAR ALL existing client markers completely
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
    console.log('🏢 ✓ All client markers cleared');

    // STEP 2: Determine which clients are in active rounds
    const activeRounds = userLocations.map(loc => loc.rounds).filter(Boolean);
    const activeTemplateIds = activeRounds.map(round => round?.template_id).filter(Boolean);
    
    console.log('🏢 Active rounds:', activeRounds.length);
    console.log('🏢 Active template IDs:', activeTemplateIds);
    
    let clientsInActiveRounds = new Set<string>();
    
    // Get clients from active templates
    if (activeTemplateIds.length > 0) {
      try {
        const { data: templateCheckpoints, error } = await supabase
          .from("round_template_checkpoints")
          .select("client_id, template_id")
          .in("template_id", activeTemplateIds);

        if (!error && templateCheckpoints) {
          clientsInActiveRounds = new Set(templateCheckpoints.map(cp => cp.client_id));
          console.log('🏢 Clients in active templates:', Array.from(clientsInActiveRounds));
        }
      } catch (error) {
        console.error('🏢 Error fetching template checkpoints:', error);
      }
    }

    // STEP 3: Fetch checkpoint data for ALL clients (not just those in active rounds)
    const clientCheckpointData: { [key: string]: { count: number, checkpoints: any[] } } = {};
    
    console.log('🏢 Fetching checkpoint data for all clients...');
    for (const client of clients) {
      const { data: checkpoints, error } = await supabase
        .from("checkpoints")
        .select("id, name, order_index")
        .eq("client_id", client.id)
        .eq("active", true)
        .order("order_index");
      
      if (!error && checkpoints) {
        clientCheckpointData[client.id] = {
          count: checkpoints.length,
          checkpoints: checkpoints
        };
        console.log(`🏢   Client "${client.name}": ${checkpoints.length} checkpoints`);
      }
    }

    // STEP 4: Create markers for ALL clients (SEMPRE VISÍVEIS)
    console.log('🏢 Creating markers for all clients...');
    let markersCreated = 0;
    
    clients.forEach(client => {
      if (client.lat && client.lng) {
        const isInActiveRound = clientsInActiveRounds.has(client.id);
        const checkpointInfo = clientCheckpointData[client.id] || { count: 0, checkpoints: [] };
        
        console.log(`🏢 Creating marker for "${client.name}": ${isInActiveRound ? 'VERMELHO (em ronda)' : 'AZUL (sem ronda)'}, ${checkpointInfo.count} pontos`);
        
        // Create client marker with number badge
        const el = document.createElement('div');
        el.style.width = '28px';
        el.style.height = '28px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = isInActiveRound ? 'hsl(var(--tactical-red))' : 'hsl(var(--tactical-blue))';
        el.style.border = '3px solid white';
        el.style.boxShadow = isInActiveRound ? 
          '0 0 15px hsl(var(--tactical-red) / 0.5), 0 2px 10px rgba(0,0,0,0.3)' : 
          '0 2px 10px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '14px';
        el.style.color = 'white';
        el.textContent = checkpointInfo.count.toString();

        // Add pulsing effect for clients in active rounds
        if (isInActiveRound) {
          el.style.animation = 'pulse 2s infinite';
        }

        // Highlight marker if it matches search or is highlighted
        const isHighlighted = highlightedMarker === client.id;
        if (isHighlighted) {
          el.style.width = '40px';
          el.style.height = '40px';
          el.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.9), 0 0 50px rgba(255, 215, 0, 0.6), 0 2px 15px rgba(0,0,0,0.4)';
          el.style.border = '4px solid gold';
          el.style.zIndex = '9999';
          el.style.fontSize = '16px';
        }

        // Build checkpoint list HTML
        let checkpointsListHTML = '';
        if (checkpointInfo.checkpoints.length > 0) {
          checkpointsListHTML = `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
              <strong style="color: #111827; font-size: 12px;">📍 Pontos de Ronda (${checkpointInfo.count}):</strong>
              <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 11px; color: #4b5563;">
                ${checkpointInfo.checkpoints.map((cp: any) => `<li>${cp.name}</li>`).join('')}
              </ul>
            </div>
          `;
        }

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([client.lng, client.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25, maxWidth: '300px' }).setHTML(`
              <div style="padding: 10px; ${isInActiveRound ? 'border: 3px solid hsl(var(--tactical-red)); background: linear-gradient(135deg, #fef2f2, #ffffff);' : ''}">
                <h3 style="margin: 0 0 5px 0; font-weight: 600; color: #111827; ${isInActiveRound ? 'color: hsl(var(--tactical-red));' : ''}">${isInActiveRound ? '🎯 ' : ''}${client.name}</h3>
                ${isInActiveRound ? '<div style="background: hsl(var(--tactical-red)); color: white; padding: 4px 8px; border-radius: 4px; margin: 0 0 5px 0; font-weight: bold; font-size: 11px; text-align: center;">🎯 INCLUÍDO NA RONDA ATIVA</div>' : ''}
                <p style="margin: 0; font-size: 12px; color: #374151;"><strong style="color: #111827;">📍 Endereço:</strong><br/>${client.address}</p>
                <p style="margin: 5px 0 0 0; font-size: 11px; color: #6b7280;">
                  <strong style="color: #111827;">🗺️ Coordenadas:</strong><br/>
                  ${client.lat.toFixed(6)}, ${client.lng.toFixed(6)}
                </p>
                ${checkpointsListHTML}
              </div>
            `)
          )
          .addTo(map.current!);

        clientMarkers.current.push(marker);
        markersCreated++;
      }
    });

    console.log('🏢 ✓ Client markers created:', markersCreated);
    console.log('🏢 === CLIENT MARKERS UPDATE COMPLETE ===');
  };

  // Remove unused functions - data now comes from useRealtimeMap hook

  const updateUserLocations = () => {
    if (!map.current || !map.current.getContainer()) return;

    console.log('👤 === UPDATING TACTICAL USER LOCATIONS ===');
    console.log('👤 Tactical users to display:', userLocations.length);
    console.log('👤 Current user markers before clear:', Object.keys(userMarkers.current).length);

    // CRITICAL: Remove ALL existing user markers first
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
    console.log('👤 ✓ All user markers cleared');

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
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #dc2626; display: flex; gap: 6px;">
                  <button onclick="window.handleViewEmergencyDetails('${location.rounds?.id}')" 
                    style="flex: 1; background: #dc2626; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">
                    📋 Ver Detalhes
                  </button>
                  <button onclick="window.open('https://maps.google.com?q=${location.lat},${location.lng}', '_blank')" 
                    style="flex: 1; background: #16a34a; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">
                    🗺️ Google Maps
                  </button>
                </div>
              ` : ''}
            </div>
          `)
        )
        .addTo(map.current!);

      userMarkers.current[location.user_id] = marker;
    });

    console.log('👤 ✓ User markers created:', Object.keys(userMarkers.current).length);
    console.log('👤 === TACTICAL USER LOCATIONS UPDATE COMPLETE ===');

    // ZOOM AUTOMÁTICO REMOVIDO - Operador controla o zoom manualmente
  };

  const expandMap = () => {
    if (map.current) {
      map.current.fitBounds(new mapboxgl.LngLatBounds([-48.5, -10.4], [-48.1, -9.9]), { padding: 50 });
    }
  };

  const handleViewEmergencyDetails = async (roundId: string) => {
    try {
      // Find the emergency incident for this round
      const { data: incident, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("round_id", roundId)
        .eq("status", "open")
        .in("priority", ["medium", "high", "critical"])
        .order("reported_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      
      if (incident) {
        setSelectedIncident(incident);
        setDetailsOpen(true);
      }
    } catch (error) {
      console.error("Error fetching emergency details:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da emergência",
        variant: "destructive",
      });
    }
  };

  // Expose function globally for popup buttons
  useEffect(() => {
    (window as any).handleViewEmergencyDetails = handleViewEmergencyDetails;
    return () => {
      delete (window as any).handleViewEmergencyDetails;
    };
  }, [activeEmergencies]);

  // Remove other unused subscription functions

  const fetchRoundCheckpoints = async (activeRounds: any[]) => {
    try {
      console.log('📍 === FETCHING CHECKPOINTS FOR ACTIVE ROUNDS ONLY ===');
      console.log('Active rounds to process:', activeRounds);
      
      if (!activeRounds || activeRounds.length === 0) {
        console.log('📍 No active rounds - clearing checkpoints');
        setRoundCheckpoints([]);
        return;
      }

      const roundIds = activeRounds.map(r => r.id).filter(Boolean);
      const templateIds = activeRounds.filter(r => r.template_id).map(r => r.template_id).filter(Boolean);
      
      if (templateIds.length === 0) {
        console.log('📍 No template-based rounds found - clearing checkpoints');
        setRoundCheckpoints([]);
        return;
      }

      console.log('📍 Round IDs:', roundIds);
      console.log('📍 Template IDs:', templateIds);

      // Get checkpoints from templates
      const { data: templateCheckpoints, error: templateError } = await supabase
        .from("round_template_checkpoints")
        .select(`
          id,
          template_id,
          client_id,
          order_index,
          required_signature
        `)
        .in("template_id", templateIds)
        .order("order_index");

      if (templateError) {
        console.error('Error fetching template checkpoints:', templateError);
        throw templateError;
      }

      console.log('Raw template checkpoints from DB:', templateCheckpoints);

      // Get all client IDs from template checkpoints
      const clientIds = [...new Set(templateCheckpoints?.map(tc => tc.client_id) || [])];
      
      console.log('Fetching individual checkpoints for clients:', clientIds);
      
      // Get individual checkpoints for each client
      const { data: clientCheckpoints, error: clientCheckpointsError } = await supabase
        .from("checkpoints")
        .select(`
          id,
          name,
          client_id,
          lat,
          lng,
          qr_code,
          manual_code,
          order_index,
          active
        `)
        .in("client_id", clientIds)
        .eq("active", true)
        .order("client_id, order_index");

      if (clientCheckpointsError) {
        console.error('Error fetching client checkpoints:', clientCheckpointsError);
        throw clientCheckpointsError;
      }
      
      console.log('Client checkpoints fetched from database:', clientCheckpoints);
      console.log('Total checkpoints found:', clientCheckpoints?.length || 0);

      // Get client data with coordinates for checkpoints without lat/lng
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, lat, lng, address")
        .in("id", clientIds)
        .eq("active", true);

      if (clientsError) {
        console.error('Error fetching clients data:', clientsError);
        throw clientsError;
      }
      
      console.log('Clients data fetched for coordinates:', clientsData);

      // Get checkpoint visits for these rounds
      const { data: visits, error: visitsError } = await supabase
        .from("checkpoint_visits")
        .select("checkpoint_id, round_id")
        .in("round_id", roundIds);

      if (visitsError) {
        console.error('Error fetching checkpoint visits:', visitsError);
        throw visitsError;
      }

      console.log('Checkpoint visits:', visits);

      // Format checkpoints with visit status
      const formattedCheckpoints: RoundCheckpoint[] = [];
      
      console.log('Processing template checkpoints:', templateCheckpoints?.length || 0);
      
      templateCheckpoints?.forEach((tc, index) => {
        console.log(`Processing template checkpoint ${index + 1}:`, tc);
        
        const activeRound = activeRounds.find(r => r.template_id === tc.template_id);
        if (!activeRound) {
          console.log("No active round found for template:", tc.template_id);
          return;
        }

        // Get all checkpoints for this client
        const checkpointsForClient = clientCheckpoints?.filter(cp => cp.client_id === tc.client_id) || [];
        
        // Get client data for this checkpoint to use as fallback coordinates
        const clientData = clientsData?.find(c => c.id === tc.client_id);
        
        console.log(`Found ${checkpointsForClient.length} checkpoints for client ${tc.client_id}:`, checkpointsForClient);
        console.log(`Client data for fallback coordinates:`, clientData);
        
        // Add each individual checkpoint to the round
        checkpointsForClient.forEach((checkpoint, cpIndex) => {
          console.log(`  Processing individual checkpoint ${cpIndex + 1}:`, checkpoint);
          
          // Use checkpoint coordinates if available, otherwise use client coordinates
          const lat = checkpoint.lat || clientData?.lat;
          const lng = checkpoint.lng || clientData?.lng;
          
          if (lat && lng) {
            const checkpointId = checkpoint.id;
            const isVisited = visits?.some(v => v.checkpoint_id === checkpointId && v.round_id === activeRound.id) || false;
            
            const formattedCheckpoint = {
              id: checkpointId,
              name: checkpoint.name,
              lat: Number(lat),
              lng: Number(lng),
              visited: isVisited,
              round_id: activeRound.id,
              client_id: tc.client_id,
              client_name: clientData?.name || checkpoint.name,
              client_address: clientData?.address || '',
              order_index: checkpoint.order_index
            };
            
            console.log("✓ Adding checkpoint to map:", formattedCheckpoint);
            formattedCheckpoints.push(formattedCheckpoint);
          } else {
            console.warn("⚠️ Checkpoint and client both missing coordinates:", checkpoint, clientData);
          }
        });
        
        // If no individual checkpoints found for this client, log warning
        if (checkpointsForClient.length === 0) {
          console.warn(`WARNING: No checkpoints found for client ${tc.client_id}. This client needs checkpoints created in the Checkpoints table.`);
        }
      });

      console.log('📍 ✓ Final checkpoint count for ACTIVE rounds:', formattedCheckpoints.length);
      console.log('📍 === CHECKPOINT FETCH COMPLETE ===\n');
      
      // Only update if checkpoints actually changed to prevent flickering
      setRoundCheckpoints(prev => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(formattedCheckpoints);
        if (hasChanged) {
          console.log('📍 Checkpoints changed - updating state');
          return formattedCheckpoints;
        }
        console.log('📍 Checkpoints unchanged - skipping update');
        return prev;
      });
    } catch (error) {
      console.error("📍 Error fetching round checkpoints:", error);
      setRoundCheckpoints([]);
    }
  };

  const updateRoundCheckpoints = () => {
    if (!map.current || !map.current.getContainer()) return;

    console.log('📍 === UPDATING CHECKPOINT MARKERS (ACTIVE ROUNDS ONLY) ===');
    console.log('📍 Round checkpoints to display:', roundCheckpoints.length);
    console.log('📍 Current checkpoint markers before clear:', checkpointMarkers.current.length);

    // Prevent unnecessary updates if markers already match
    if (checkpointMarkers.current.length === roundCheckpoints.length && roundCheckpoints.length > 0) {
      console.log('📍 ⚠️ Skipping update - markers already match checkpoints');
      return;
    }

    // CRITICAL: Remove ALL existing checkpoint markers first
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
    console.log('📍 ✓ All checkpoint markers cleared');

    // If no checkpoints, just return
    if (roundCheckpoints.length === 0) {
      console.log('📍 No checkpoints to display');
      console.log('📍 === CHECKPOINT MARKERS UPDATE COMPLETE ===');
      return;
    }

    // Add checkpoint markers
    roundCheckpoints.forEach(checkpoint => {
      // Create checkpoint marker - VERDE se concluído, VERMELHO se pendente
      const el = document.createElement('div');
      el.style.width = '26px';
      el.style.height = '26px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = checkpoint.visited ? '#10b981' : '#ef4444';
      el.style.border = '3px solid white';
      el.style.boxShadow = checkpoint.visited 
        ? '0 2px 12px rgba(16, 185, 129, 0.5)' 
        : '0 2px 12px rgba(239, 68, 68, 0.5)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontSize = '11px';
      el.style.fontWeight = 'bold';
      el.textContent = checkpoint.visited ? '✓' : checkpoint.order_index.toString();

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([checkpoint.lng, checkpoint.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, maxWidth: '300px' }).setHTML(`
            <div style="padding: 14px; ${checkpoint.visited ? 'border: 3px solid #10b981;' : 'border: 3px solid #ef4444;'} border-radius: 8px; background: white; min-width: 250px;">
              <h3 style="margin: 0 0 8px 0; font-weight: 700; font-size: 15px; color: #111827;">
                ${checkpoint.visited ? '✓ ' : '⏳ '}${checkpoint.name}
              </h3>
              
              <div style="background: ${checkpoint.visited ? '#10b981' : '#ef4444'}; color: white; padding: 8px 12px; border-radius: 6px; margin: 0 0 12px 0; font-weight: bold; font-size: 13px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${checkpoint.visited ? '✓ PONTO CONCLUÍDO' : '⏳ RONDA NÃO FINALIZADA'}
              </div>
              
              <div style="margin: 10px 0; background: #f9fafb; padding: 10px; border-radius: 6px;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: ${checkpoint.visited ? '#059669' : '#dc2626'}; font-weight: 700;">
                  Status: ${checkpoint.visited ? 'CONCLUÍDO ✓' : 'PENDENTE ⏳'}
                </p>
                <p style="margin: 0 0 4px 0; font-size: 11px; color: #111827;">
                  <strong style="color: #111827;">Ordem:</strong> <span style="color: #374151; font-weight: 600;">#${checkpoint.order_index}</span>
                </p>
                <p style="margin: 0 0 4px 0; font-size: 11px; color: #111827;">
                  <strong style="color: #111827;">Cliente:</strong> <span style="color: #374151; font-weight: 600;">${checkpoint.client_name || checkpoint.name}</span>
                </p>
                ${checkpoint.client_address ? `
                  <p style="margin: 0 0 4px 0; font-size: 10px; color: #111827;">
                    <strong style="color: #111827;">📍 Endereço:</strong><br/>
                    <span style="color: #6b7280; line-height: 1.4;">${checkpoint.client_address}</span>
                  </p>
                ` : ''}
                <p style="margin: 4px 0 0 0; font-size: 10px; color: #111827;">
                  <strong style="color: #111827;">🗺️ Coordenadas:</strong><br/>
                  <span style="color: #6b7280; font-family: monospace;">${checkpoint.lat.toFixed(6)}, ${checkpoint.lng.toFixed(6)}</span>
                </p>
              </div>
              
              ${!checkpoint.visited ? `
                <div style="margin-top: 10px; padding: 8px 10px; background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 4px;">
                  <p style="margin: 0; font-size: 11px; color: #991b1b; font-weight: 600;">
                    ⚠️ Aguardando visita do tático
                  </p>
                </div>
              ` : `
                <div style="margin-top: 10px; padding: 8px 10px; background: #f0fdf4; border-left: 3px solid #10b981; border-radius: 4px;">
                  <p style="margin: 0; font-size: 11px; color: #065f46; font-weight: 600;">
                    ✓ Ronda finalizada com sucesso
                  </p>
                </div>
              `}
            </div>
          `)
        )
        .addTo(map.current!);

      checkpointMarkers.current.push(marker);
    });

    console.log('📍 ✓ Checkpoint markers created:', checkpointMarkers.current.length);
    console.log('📍 === CHECKPOINT MARKERS UPDATE COMPLETE ===');
  };

  const refreshMap = () => {
    fetchAllData();
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || !map.current) return;

    const query = searchQuery.toLowerCase().trim();
    
    // Search in clients
    const foundClient = clients.find(client => 
      client.name.toLowerCase().includes(query)
    );

    if (foundClient) {
      // Highlight the marker
      setHighlightedMarker(foundClient.id);
      
      // Center map on the found location
      map.current.flyTo({
        center: [foundClient.lng, foundClient.lat],
        zoom: 16,
        duration: 2000
      });

      // Show popup
      setTimeout(() => {
        const marker = clientMarkers.current.find(m => {
          const lngLat = m.getLngLat();
          return lngLat.lng === foundClient.lng && lngLat.lat === foundClient.lat;
        });
        if (marker) {
          marker.togglePopup();
        }
      }, 2000);

      toast({
        title: "Cliente encontrado!",
        description: `${foundClient.name} foi localizado no mapa`,
      });

      // Remove highlight after 5 seconds
      setTimeout(() => {
        setHighlightedMarker(null);
        updateClientMarkers();
      }, 5000);
    } else {
      toast({
        title: "Cliente não encontrado",
        description: `Nenhum cliente encontrado com o nome "${searchQuery}"`,
        variant: "destructive"
      });
    }
  };

  // Render expanded fullscreen version
  if (isExpanded) {
    return (
      <div className="w-full h-full bg-background">
        {/* Header with Search Bar */}
        <div className="flex items-center justify-between gap-4 p-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <Navigation className="w-5 h-5 text-card-foreground" />
            <span className="font-semibold text-card-foreground whitespace-nowrap">Monitoramento em Tempo Real</span>
          </div>
          
          {/* Search Bar */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} variant="default" size="sm">
              <Search className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Status Badges */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {clients.length} clientes • {userLocations.length} táticos
            </Badge>
            {hasActiveAlert && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                🚨 {activeEmergencies.length}
              </Badge>
            )}
            <Badge 
              variant={isAutoUpdating ? "default" : "secondary"} 
              className="flex items-center gap-1 text-xs"
            >
              <div className={`w-2 h-2 rounded-full ${isAutoUpdating ? 'bg-tactical-green animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="hidden lg:inline">{isAutoUpdating ? 'Auto' : 'Off'}</span>
            </Badge>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {onOpenNewWindow && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenNewWindow}
                className="border-tactical-blue text-tactical-blue hover:bg-tactical-blue hover:text-white"
                title="Abrir em Nova Janela"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Full Screen Map */}
        <div ref={mapContainer} className="w-full h-[calc(100vh-120px)]">
          <FullscreenEmergencyAlert isFullscreen={true} />
        </div>
        
        <CheckpointNotification enabled={true} />
        
        {selectedIncident && (
          <IncidentDetailsDialog
            open={detailsOpen}
            onClose={() => {
              setDetailsOpen(false);
              setSelectedIncident(null);
            }}
            incident={selectedIncident}
            onRefresh={() => {
              fetchAllData();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <Card className="tactical-card">
      <CardHeader className="space-y-4">
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
            <Badge 
              variant={isAutoUpdating ? "default" : "secondary"} 
              className="flex items-center gap-2"
            >
              <div className={`w-2 h-2 rounded-full ${isAutoUpdating ? 'bg-tactical-green animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-xs">
                {isAutoUpdating ? 'Auto-Atualização Ativa' : 'Desconectado'}
              </span>
            </Badge>
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
            <div className="text-xs text-muted-foreground">
              Última atualização: {lastUpdateTime.toLocaleTimeString('pt-BR')}
            </div>
          </div>
        </CardTitle>
        
        {/* Search Bar */}
        <div className="flex items-center gap-2 px-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar empresa por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} variant="default" size="sm">
            <Search className="w-4 h-4 mr-2" />
            Localizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div id="realtime-map" ref={mapContainer} className="w-full h-[500px] rounded-lg relative">
          {/* Emergency alerts - always visible, positioned based on fullscreen state */}
          <FullscreenEmergencyAlert isFullscreen={isFullscreen} />
          
          {/* Full screen controls overlay */}
          <div className="fullscreen-controls absolute top-4 left-4 z-50 hidden bg-background/90 backdrop-blur-sm p-2 rounded-lg border">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-background/50 px-3 py-1 rounded">
                <div className="w-2 h-2 bg-tactical-green rounded-full animate-pulse"></div>
                <span className="text-xs text-foreground">Atualização Automática</span>
              </div>
              {hasActiveAlert && (
                <div className="flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-xs font-bold">🚨 {activeEmergencies.length} EMERGÊNCIA(S)</span>
                </div>
              )}
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

      {/* Incident Details Dialog */}
      {selectedIncident && (
        <IncidentDetailsDialog
          open={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedIncident(null);
          }}
          incident={selectedIncident}
          onRefresh={() => {
            fetchAllData();
          }}
        />
      )}
    </Card>
  );
};

export default RealtimeMap;