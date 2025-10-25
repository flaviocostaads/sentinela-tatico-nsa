import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface EmergencyIncident {
  id: string;
  round_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  reported_at: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
}

export const useRealtimeMap = () => {
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyIncident[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [isAutoUpdating, setIsAutoUpdating] = useState(false);
  const [isUserMoving, setIsUserMoving] = useState(false);
  const { toast } = useToast();
  const channelsRef = useRef<any[]>([]);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Initialize real-time subscriptions and auto-refresh
  useEffect(() => {
    const initializeRealtime = () => {
      // Clean up existing channels
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];

      // Set up real-time subscriptions
      const userLocationsChannel = supabase
        .channel('user-locations-live')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_locations',
          filter: 'is_active=eq.true'
        }, (payload) => {
          console.log('🔄 Real-time location update:', payload);
          fetchUserLocations();
          setLastUpdateTime(new Date());
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rounds'
        }, (payload) => {
          console.log('🔄 Real-time rounds update:', payload);
          fetchUserLocations();
          setLastUpdateTime(new Date());
        })
        .subscribe();

      const emergencyChannel = supabase
        .channel('emergency-incidents-live')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'incidents'
        }, (payload) => {
          console.log('🚨 Real-time emergency update:', payload);
          fetchActiveEmergencies();
          setLastUpdateTime(new Date());
          
          // Show toast for new critical emergencies
          if (payload.eventType === 'INSERT' && payload.new?.priority === 'critical') {
            toast({
              title: "🚨 NOVA EMERGÊNCIA CRÍTICA",
              description: "Uma nova emergência foi reportada no mapa",
              variant: "destructive",
            });
          }
        })
        .subscribe();

      const checkpointChannel = supabase
        .channel('checkpoint-visits-live')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'checkpoint_visits'
        }, (payload) => {
          console.log('📍 Real-time checkpoint update:', payload);
          fetchUserLocations(); // This also updates checkpoints
          setLastUpdateTime(new Date());
        })
        .subscribe();

      channelsRef.current = [userLocationsChannel, emergencyChannel, checkpointChannel];

      // Initial data fetch
      fetchAllData();

      setIsAutoUpdating(true);

      return () => {
        channelsRef.current.forEach(channel => {
          supabase.removeChannel(channel);
        });
        if (autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current);
          autoRefreshIntervalRef.current = null;
        }
        setIsAutoUpdating(false);
      };
    };

    return initializeRealtime();
  }, []);

  // Detect user movement and enable continuous tracking
  useEffect(() => {
    if (userLocations.length === 0) {
      setIsUserMoving(false);
      return;
    }

    const currentLocation = userLocations[0]; // Latest location
    const currentPos = { lat: currentLocation.lat, lng: currentLocation.lng };

    // Check if user moved (distance > 10 meters)
    if (lastPositionRef.current) {
      const distance = calculateDistance(
        lastPositionRef.current.lat,
        lastPositionRef.current.lng,
        currentPos.lat,
        currentPos.lng
      );
      
      const isMoving = distance > 0.01; // ~10 meters threshold
      console.log(`📍 Movement detected: ${distance.toFixed(4)} km - ${isMoving ? 'MOVING' : 'STOPPED'}`);
      
      setIsUserMoving(isMoving);

      // Start continuous tracking when moving
      if (isMoving && !autoRefreshIntervalRef.current) {
        console.log('🚀 Starting continuous GPS tracking (user is moving)');
        autoRefreshIntervalRef.current = setInterval(() => {
          console.log('🔄 Auto-refresh (movement tracking)');
          fetchUserLocations(); // Only track position, not full data
          setLastUpdateTime(new Date());
        }, 2000);
      }
      
      // Stop continuous tracking when stopped
      if (!isMoving && autoRefreshIntervalRef.current) {
        console.log('⏸️ Stopping continuous tracking (user stopped)');
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    }

    lastPositionRef.current = currentPos;
  }, [userLocations]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchUserLocations(),
      fetchClients(),
      fetchActiveEmergencies()
    ]);
  };

  const fetchUserLocations = async () => {
    try {
      // Get locations
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
    } catch (error) {
      console.error("Error fetching user locations:", error);
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
      setClients(clientData || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchActiveEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, lat, lng, title, description')
        .eq('status', 'open')
        .in('priority', ['medium', 'high', 'critical'])
        .order('reported_at', { ascending: false });

      if (error) throw error;
      setActiveEmergencies(data || []);
    } catch (error) {
      console.error('Error fetching active emergencies:', error);
    }
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  return {
    userLocations,
    clients,
    activeEmergencies,
    lastUpdateTime,
    isAutoUpdating,
    isUserMoving,
    fetchAllData
  };
};