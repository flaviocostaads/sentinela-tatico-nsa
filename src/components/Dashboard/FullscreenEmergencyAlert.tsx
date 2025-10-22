import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X, MapPin, Clock, User, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface EmergencyIncident {
  id: string;
  title: string;
  description?: string;
  type: 'security' | 'maintenance' | 'emergency' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  lat?: number;
  lng?: number;
  reported_at: string;
  round_id: string;
  rounds?: {
    clients: {
      name: string;
    };
    profiles?: {
      name: string;
    } | null;
  };
}

interface FullscreenEmergencyAlertProps {
  isFullscreen?: boolean;
}

const FullscreenEmergencyAlert = ({ isFullscreen = false }: FullscreenEmergencyAlertProps) => {
  const [emergencyIncidents, setEmergencyIncidents] = useState<EmergencyIncident[]>([]);
  const [visible, setVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  // Only show for admins and operators
  const canViewAlerts = profile?.role === 'admin' || profile?.role === 'operador';

  useEffect(() => {
    if (!canViewAlerts) return;

    subscribeToEmergencies();
    fetchActiveEmergencies();

    // Initialize audio with Web Audio API for better browser support
    const initializeAudio = () => {
      try {
        audioRef.current = new Audio();
        // Simple beep sound data URI
        audioRef.current.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFNYTJ8N2QQAoUXrTp66hVFApGn+Hsv2kMBjaH0fPsZSACLXfH7+CVLAAOO8fZ8KlZAAA=";
      } catch (error) {
        console.warn('Could not initialize audio:', error);
      }
    };

    initializeAudio();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const channels = supabase.getChannels();
      channels.forEach(channel => {
        if (channel.topic.includes('fullscreen-emergency')) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, [canViewAlerts]);

  const subscribeToEmergencies = () => {
    const channel = supabase
      .channel('fullscreen-emergency-incidents')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents',
        filter: 'status=eq.open'
      }, (payload) => {
        console.log('🚨 Fullscreen emergency update:', payload);
        
        // Check if it's high priority or emergency type
        const newIncident = payload.new as any;
        const isHighPriority = newIncident?.priority === 'critical' || newIncident?.priority === 'high';
        const isEmergencyType = newIncident?.type === 'emergency';
        
        if (isHighPriority || isEmergencyType) {
          fetchActiveEmergencies();
          playAlertSound();
          
          if (isFullscreen) {
            toast({
              title: "🚨 NOVA EMERGÊNCIA",
              description: `${newIncident?.title} - Prioridade: ${newIncident?.priority}`,
              variant: "destructive",
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchActiveEmergencies = async () => {
    if (!canViewAlerts) return;

    try {
      const { data, error } = await supabase
        .from("incidents")
        .select(`
          *,
          rounds (
            clients (name),
            profiles (name)
          )
        `)
        .eq("status", "open")
        .in("priority", ["critical", "high"])
        .order("reported_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      
      setEmergencyIncidents(data || []);
      
      if ((data || []).length > 0) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch (error) {
      console.error("Error fetching emergency incidents:", error);
    }
  };

  const playAlertSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(e => {
        console.log("Could not play alert sound:", e);
      });
    }
  };

  const dismissIncident = async (incidentId: string) => {
    try {
      const { error } = await supabase
        .from("incidents")
        .update({ status: 'investigating' })
        .eq("id", incidentId);

      if (error) throw error;

      setEmergencyIncidents(prev => prev.filter(inc => inc.id !== incidentId));
      
      if (emergencyIncidents.length <= 1) {
        setVisible(false);
      }

      toast({
        title: "Ocorrência em investigação",
        description: "Status atualizado para investigação",
      });
    } catch (error) {
      console.error("Error updating incident:", error);
    }
  };

  const formatTimeSince = (timestamp: string) => {
    const now = new Date();
    const incident = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - incident.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}min atrás`;
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ${diffInMinutes % 60}min atrás`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-600 text-white';
      case 'medium': return 'bg-yellow-600 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  if (!canViewAlerts || !visible || emergencyIncidents.length === 0) {
    return null;
  }

  return (
    <div 
      className={`fixed z-[9999] space-y-2 ${
        isFullscreen 
          ? 'top-4 right-4 max-w-sm' 
          : 'top-20 right-4 max-w-md'
      }`}
      style={{ zIndex: isFullscreen ? 999999 : 50 }}
    >
      {/* Header with minimize option */}
      <div className="flex items-center justify-between mb-2 bg-red-600 text-white p-2 rounded-t-lg">
        <div className="flex items-center gap-2 font-semibold">
          <Bell className="w-4 h-4 animate-bounce" />
          <span className="text-xs">Alertas de Emergência ({emergencyIncidents.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-6 w-6 p-0 text-white hover:bg-red-700"
          >
            {soundEnabled ? "🔊" : "🔇"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 p-0 text-white hover:bg-red-700"
          >
            {isMinimized ? "⬆️" : "⬇️"}
          </Button>
        </div>
      </div>

      {/* Alert cards - show/hide based on minimized state */}
      {!isMinimized && emergencyIncidents.map((incident) => (
        <Card key={incident.id} className="border-red-600 bg-red-50 dark:bg-red-950/20 shadow-2xl">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
                <Badge className={`${getPriorityColor(incident.priority)} text-xs`}>
                  {getPriorityLabel(incident.priority)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissIncident(incident.id)}
                className="h-5 w-5 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-red-600 text-xs">
                🚨 {incident.title}
              </h3>
              
              {incident.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {incident.description.substring(0, 80)}...
                </p>
              )}

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeSince(incident.reported_at)}</span>
                </div>
                
                {incident.rounds?.profiles?.name && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Tático: {incident.rounds.profiles.name}</span>
                  </div>
                )}
                
                {incident.lat && incident.lng && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        window.open(`https://maps.google.com?q=${incident.lat},${incident.lng}`, '_blank');
                      }}
                      className="p-0 h-auto text-xs text-blue-600"
                    >
                      Ver localização
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex space-x-1 pt-2">
                <Button
                  size="sm"
                  onClick={() => dismissIncident(incident.id)}
                  className="text-xs bg-yellow-600 hover:bg-yellow-700 h-6 px-2"
                >
                  Investigar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (isFullscreen && document.exitFullscreen) {
                      document.exitFullscreen();
                    }
                    setTimeout(() => {
                      window.location.href = '/incidents';
                    }, 100);
                  }}
                  className="text-xs h-6 px-2"
                >
                  Detalhes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Pulsing style animation */}
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

export default FullscreenEmergencyAlert;