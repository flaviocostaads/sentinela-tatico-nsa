import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

interface UseGpsTrackingOptions {
  enableRealtime?: boolean;
  autoStart?: boolean;
  updateInterval?: number;
}

export const useGpsTracking = (options: UseGpsTrackingOptions = {}) => {
  const { enableRealtime = true, autoStart = true, updateInterval = 3000 } = options;
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [hasActiveRound, setHasActiveRound] = useState(false);
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Always start immediate location tracking for tactical users
    startImmediateTracking();
    
    if (autoStart) {
      startTracking();
    }

    // Check for active rounds periodically
    const roundCheckInterval = setInterval(checkForActiveRounds, 10000);

    return () => {
      stopTracking();
      clearInterval(roundCheckInterval);
    };
  }, [autoStart]);

  const startImmediateTracking = async () => {
    try {
      // Get immediate location when tactical user logs in
      const position = await getCurrentPosition();
      setCurrentLocation(position);
      
      // Save initial location to database
      await saveLocationToDatabase(position);
    } catch (error) {
      console.error("Error getting immediate location:", error);
    }
  };

  const checkForActiveRounds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: activeRounds } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active");

      const hasActive = (activeRounds?.length || 0) > 0;
      setHasActiveRound(hasActive);

      // If user has active rounds but isn't tracking, start tracking
      if (hasActive && !isTracking && enableRealtime) {
        startTracking();
      }
    } catch (error) {
      console.error("Error checking active rounds:", error);
    }
  };

  const startTracking = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "GPS não disponível",
        description: "Seu dispositivo não suporta geolocalização",
        variant: "destructive",
      });
      return;
    }

    setIsTracking(true);

    // Start watching position
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
        };

        setCurrentLocation(locationData);
        setAccuracy(position.coords.accuracy);
        
        // Only save to database on interval, not on every GPS update to reduce logs
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          title: "Erro de GPS",
          description: `Erro ao obter localização: ${error.message}`,
          variant: "destructive",
        });
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    // Set up periodic updates for database - less frequent to reduce logs
    if ((enableRealtime || hasActiveRound) && updateInterval > 0) {
      const interval = hasActiveRound ? 10000 : updateInterval * 2; // 10 seconds during active rounds, reduce frequency otherwise
      intervalId.current = setInterval(() => {
        if (currentLocation) {
          saveLocationToDatabase(currentLocation);
        }
      }, interval);
    }
  };

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }

    setIsTracking(false);
  };

  const saveLocationToDatabase = async (location: LocationData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for active round
      const { data: activeRound } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      await supabase
        .from("user_locations")
        .insert([{
          user_id: user.id,
          round_id: activeRound?.id || null,
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
        }]);

    } catch (error) {
      console.error("Error saving location:", error);
    }
  };

  const getCurrentPosition = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
          };
          resolve(locationData);
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    });
  };

  return {
    currentLocation,
    isTracking,
    accuracy,
    hasActiveRound,
    startTracking,
    stopTracking,
    getCurrentPosition,
    startImmediateTracking,
  };
};