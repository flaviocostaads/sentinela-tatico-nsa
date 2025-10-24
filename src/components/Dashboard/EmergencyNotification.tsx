import { useState, useEffect } from "react";
import { AlertTriangle, X, MapPin, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import IncidentDetailsDialog from "@/components/TacticApp/IncidentDetailsDialog";

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
  user_locations?: {
    lat: number;
    lng: number;
    recorded_at: string;
  }[];
  profiles?: {
    name: string;
  };
}

const EmergencyNotification = () => {
  const [emergencyIncidents, setEmergencyIncidents] = useState<EmergencyIncident[]>([]);
  const [visible, setVisible] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    subscribeToEmergencies();
    fetchActiveEmergencies();
  }, []);

  const subscribeToEmergencies = () => {
    const channel = supabase
      .channel('emergency-incidents')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'incidents',
        filter: 'status=eq.open'
      }, (payload) => {
        console.log('New emergency incident:', payload);
        fetchActiveEmergencies();
        setVisible(true);
        
        // Show toast notification
        toast({
          title: "🚨 EMERGÊNCIA IMEDIATA",
          description: `Nova ocorrência: ${payload.new.title}`,
          variant: "destructive",
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchActiveEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select(`
          *,
          profiles:user_locations!user_locations_user_id_fkey (
            name
          )
        `)
        .eq("status", "open")
        .eq("priority", "critical")
        .order("reported_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      
      // Map the data to match the expected interface
      const incidents = (data || []).map(incident => ({
        ...incident,
        user_locations: [], // Simplified for now
        profiles: null // Simplified for now
      }));
      
      setEmergencyIncidents(incidents);
      
      if (incidents.length > 0) {
        setVisible(true);
      }
    } catch (error) {
      console.error("Error fetching emergency incidents:", error);
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
      case 'critical': return 'bg-tactical-red text-white';
      case 'high': return 'bg-tactical-amber text-white';
      case 'medium': return 'bg-tactical-blue text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleViewDetails = async (incident: EmergencyIncident) => {
    try {
      // Fetch full incident details
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("id", incident.id)
        .single();

      if (error) throw error;
      
      setSelectedIncident(data);
      setDetailsOpen(true);
    } catch (error) {
      console.error("Error fetching incident details:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da ocorrência",
        variant: "destructive",
      });
    }
  };

  if (!visible || emergencyIncidents.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2">
      {emergencyIncidents.map((incident) => (
        <Card key={incident.id} className="border-tactical-red bg-tactical-red/10 animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-tactical-red animate-bounce" />
                <Badge className={getPriorityColor(incident.priority)}>
                  {incident.priority.toUpperCase()}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissIncident(incident.id)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-tactical-red">
                🚨 {incident.title}
              </h3>
              
              {incident.description && (
                <p className="text-sm text-muted-foreground">
                  {incident.description}
                </p>
              )}

              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeSince(incident.reported_at)}</span>
                </div>
                
                {incident.profiles?.name && (
                  <div className="flex items-center space-x-1">
                    <User className="w-3 h-3" />
                    <span>{incident.profiles.name}</span>
                  </div>
                )}
              </div>

              {incident.user_locations && incident.user_locations.length > 0 && (
                <div className="bg-background/50 p-2 rounded text-xs">
                  <div className="flex items-center space-x-1 text-tactical-red">
                    <MapPin className="w-3 h-3" />
                    <span className="font-medium">Localização em Tempo Real:</span>
                  </div>
                  <div className="mt-1 font-mono text-xs">
                    Lat: {incident.user_locations[0].lat.toFixed(6)}
                    <br />
                    Lng: {incident.user_locations[0].lng.toFixed(6)}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Atualizada: {formatTimeSince(incident.user_locations[0].recorded_at)}
                  </div>
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => dismissIncident(incident.id)}
                  className="text-xs"
                >
                  Investigar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewDetails(incident)}
                  className="text-xs"
                >
                  Ver Detalhes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (incident.lat && incident.lng) {
                      window.open(`https://maps.google.com?q=${incident.lat},${incident.lng}`, '_blank');
                    }
                  }}
                  className="text-xs"
                >
                  Ver no Mapa
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

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
            fetchActiveEmergencies();
          }}
        />
      )}
    </div>
  );
};

export default EmergencyNotification;