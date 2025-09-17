import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PanicButtonProps {
  onNavigate: (view: 'incident') => void;
}

const PanicButton = ({ onNavigate }: PanicButtonProps) => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const { toast } = useToast();

  const HOLD_DURATION = 3000; // 3 seconds

  useEffect(() => {
    getCurrentLocation();
    getActiveRound();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }
  };

  const getActiveRound = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: activeRound } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      setActiveRoundId(activeRound?.id || null);
    } catch (error) {
      console.error("Error getting active round:", error);
    }
  };

  const createPanicAlert = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use active round or create a default emergency round ID
      const roundId = activeRoundId || "00000000-0000-0000-0000-000000000000";

      let locationData = currentLocation;
      if (!locationData) {
        // Try to get location immediately for emergency
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: true
            });
          });
          locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        } catch {
          locationData = { lat: 0, lng: 0 }; // Default fallback
        }
      }

      const emergencyData = {
        round_id: roundId,
        title: "🚨 ALERTA DE PÂNICO - EMERGÊNCIA CRÍTICA",
        description: `ATENÇÃO: Tático ativou botão de pânico. Localização: ${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}. Resposta imediata necessária!`,
        type: 'emergency' as const,
        priority: 'critical' as const,
        status: 'open',
        lat: locationData.lat,
        lng: locationData.lng
      };

      const { error } = await supabase
        .from("incidents")
        .insert([emergencyData]);

      if (error) {
        throw error;
      }

      // Silent success - no toast notification for tactic user to avoid revealing their location
      console.log("Panic alert created successfully");
      
    } catch (error) {
      console.error("Error creating panic alert:", error);
      // Silent error handling - don't show error to tactic user
    }
  };

  const handleMouseDown = () => {
    setIsHolding(true);
    setHoldProgress(0);
  };

  const handleMouseUp = () => {
    if (isHolding) {
      if (holdProgress >= 100) {
        // Panic button activated - create silent emergency alert
        createPanicAlert();
        // Reset progress silently
        setHoldProgress(0);
      } else {
        // Normal click - navigate to incident screen
        onNavigate('incident');
      }
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  const handleMouseLeave = () => {
    setIsHolding(false);
    setHoldProgress(0);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isHolding) {
      interval = setInterval(() => {
        setHoldProgress(prev => {
          const newProgress = prev + (100 / (HOLD_DURATION / 50)); // Update every 50ms
          return Math.min(newProgress, 100);
        });
      }, 50);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isHolding]);

  return (
    <div className="relative">
      <Button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        className="w-full h-16 bg-card hover:bg-accent border-2 border-tactical-red/20 rounded-xl flex items-center justify-center shadow-sm transition-colors group pulse-tactical relative overflow-hidden"
        style={{
          background: holdProgress > 0 
            ? `linear-gradient(90deg, hsl(var(--tactical-red)) ${holdProgress}%, transparent ${holdProgress}%)`
            : undefined
        }}
      >
        <div className="w-12 h-12 bg-tactical-red/10 rounded-xl flex items-center justify-center mr-4 group-hover:bg-tactical-red/20 transition-colors relative z-10">
          <AlertTriangle className="w-6 h-6 text-tactical-red" />
        </div>
        <div className="text-left relative z-10">
          <span className="text-lg font-semibold block text-foreground">
            {holdProgress > 0 ? "Ativando Pânico..." : "Ocorrência Rápida"}
          </span>
          <span className="text-sm text-muted-foreground">
            {holdProgress > 0 ? `${Math.round(holdProgress)}%` : "Reportar emergência"}
          </span>
        </div>
        
        {/* Visual progress indicator */}
        {holdProgress > 0 && (
          <div 
            className="absolute inset-0 bg-tactical-red/20 transition-all duration-75"
            style={{ 
              width: `${holdProgress}%`,
              background: `linear-gradient(90deg, 
                hsl(var(--tactical-red) / 0.3) 0%, 
                hsl(var(--tactical-red) / 0.1) 100%)`
            }}
          />
        )}
      </Button>
      
      {/* Instructions text */}
      <p className="text-xs text-muted-foreground text-center mt-2">
        Toque: Ocorrência • Segure 3s: Pânico Silencioso
      </p>
    </div>
  );
};

export default PanicButton;