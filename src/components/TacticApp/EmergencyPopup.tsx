import { useState, useEffect } from "react";
import { AlertTriangle, X, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Emergency {
  id: string;
  title: string;
  description: string;
  priority: string;
  lat: number;
  lng: number;
  reported_at: string;
}

const EmergencyPopup = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());
  const { toast } = useToast();
  const { profile } = useAuth();

  // Only show alerts to admin and operador, never to tatico
  const shouldShowAlerts = profile?.role === 'admin' || profile?.role === 'operador';

  useEffect(() => {
    // Only run for admin and operador roles
    if (!shouldShowAlerts) return;

    // Check for new emergencies every 10 seconds
    const interval = setInterval(() => {
      checkForNewEmergencies();
    }, 10000);

    // Initial check
    checkForNewEmergencies();

    return () => clearInterval(interval);
  }, [shouldShowAlerts]);

  const checkForNewEmergencies = async () => {
    try {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("type", "emergency")
        .eq("status", "open")
        .gte("reported_at", lastCheckTime.toISOString())
        .order("reported_at", { ascending: false });

      if (data && data.length > 0) {
        const newEmergencies = data.map(incident => ({
          id: incident.id,
          title: incident.title,
          description: incident.description || "",
          priority: incident.priority,
          lat: incident.lat || 0,
          lng: incident.lng || 0,
          reported_at: incident.reported_at
        }));

        setEmergencies(prev => [...newEmergencies, ...prev].slice(0, 5)); // Keep only last 5
        setLastCheckTime(new Date());

        // Show system notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🚨 EMERGÊNCIA REPORTADA', {
            body: newEmergencies[0].title,
            icon: '/favicon.ico'
          });
        }

        // Play alert sound
        playAlertSound();

        // Show toast notification
        toast({
          title: "🚨 EMERGÊNCIA DETECTADA",
          description: `${newEmergencies.length} nova(s) emergência(s) reportada(s)`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking for emergencies:", error);
    }
  };

  const playAlertSound = () => {
    // Create audio context for alert sound
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error("Could not play alert sound:", error);
    }
  };

  const dismissEmergency = (id: string) => {
    setEmergencies(prev => prev.filter(e => e.id !== id));
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-tactical-red';
      case 'high': return 'bg-tactical-amber';
      default: return 'bg-tactical-red';
    }
  };

  // Don't show alerts to tatico users or if no emergencies
  if (!shouldShowAlerts || emergencies.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
      {emergencies.map((emergency) => (
        <Card key={emergency.id} className={`border-2 border-tactical-red shadow-2xl ${getPriorityColor(emergency.priority)}`} style={{
          animation: 'emergencyPulse 2s infinite'
        }}>
          <CardContent className="p-4 text-white">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
                <span className="font-bold text-lg">EMERGÊNCIA</span>
              </div>
              <Button
                onClick={() => dismissEmergency(emergency.id)}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20 p-1 h-auto"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">{emergency.title}</h3>
              {emergency.description && (
                <p className="text-sm opacity-90">{emergency.description}</p>
              )}
              
              <div className="flex items-center justify-between text-xs opacity-80">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(emergency.reported_at)}</span>
                </div>
                {(emergency.lat !== 0 || emergency.lng !== 0) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>Localizada</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-3">
                <Button 
                  size="sm" 
                  variant="secondary"
                  className="text-xs flex-1 bg-white/20 hover:bg-white/30 text-white border-white/20"
                  onClick={() => window.open(`/incidents`, '_blank')}
                >
                  Ver Detalhes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes emergencyPulse {
            0%, 100% { 
              box-shadow: 0 0 20px rgba(220, 38, 38, 0.8);
              transform: scale(1);
            }
            50% { 
              box-shadow: 0 0 40px rgba(220, 38, 38, 1);
              transform: scale(1.02);
            }
          }
        `
      }} />
    </div>
  );
};

export default EmergencyPopup;