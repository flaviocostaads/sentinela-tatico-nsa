import { useState, useEffect } from "react";
import { ArrowLeft, AlertTriangle, Clock, Eye, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import IncidentDialog from "./IncidentDialog";
import IncidentDetailsDialog from "./IncidentDetailsDialog";

interface TacticIncidentProps {
  onBack: () => void;
}

interface Incident {
  id: string;
  title: string;
  description?: string;
  type: 'security' | 'maintenance' | 'emergency' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  lat?: number;
  lng?: number;
  reported_at: string;
  round_id?: string;
}

const TacticIncident = ({ onBack }: TacticIncidentProps) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentLocation();
    fetchMyIncidents();
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
          toast({
            title: "Erro de Localização",
            description: "Não foi possível obter sua localização atual",
            variant: "destructive",
          });
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

  const fetchMyIncidents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get incidents from today for this user's rounds
      const today = new Date().toISOString().split('T')[0];
      
      const { data: roundsData } = await supabase
        .from("rounds")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", today + "T00:00:00.000Z");

      if (roundsData && roundsData.length > 0) {
        const roundIds = roundsData.map(r => r.id);
        
        const { data, error } = await supabase
          .from("incidents")
          .select("*")
          .in("round_id", roundIds)
          .order("reported_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setIncidents(data || []);
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
    }
  };

  const quickEmergency = () => {
    if (!activeRoundId) {
      toast({
        title: "Ronda Necessária",
        description: "Você precisa estar em uma ronda ativa para reportar ocorrências.",
        variant: "destructive",
      });
      return;
    }
    setReportDialogOpen(true);
  };

  const handleIncidentReported = () => {
    setReportDialogOpen(false);
    fetchMyIncidents();
    toast({
      title: "Ocorrência Reportada",
      description: "Ocorrência registrada com sucesso!",
    });
  };

  const handleViewDetails = (incident: Incident) => {
    setSelectedIncident(incident);
    setDetailsDialogOpen(true);
  };


  const getIncidentTypeLabel = (type: string) => {
    switch (type) {
      case 'security': return 'Segurança';
      case 'maintenance': return 'Manutenção';
      case 'emergency': return 'Emergência';
      case 'other': return 'Outros';
      default: return type;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-tactical-red text-white';
      case 'high': return 'bg-tactical-amber text-white';
      case 'medium': return 'bg-tactical-blue text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
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
              <h1 className="text-lg font-semibold text-tactical-red">Ocorrência Rápida</h1>
              <p className="text-sm text-muted-foreground">
                Sistema de alerta imediato
              </p>
            </div>
          </div>
          
          <Button 
            onClick={() => setReportDialogOpen(true)}
            className="bg-tactical-red hover:bg-tactical-red/90"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Reportar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Emergency Button */}
        <Card className="border-tactical-red">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-16 h-16 text-tactical-red mx-auto mb-4" />
            <h2 className="text-xl font-bold text-tactical-red mb-2">
              EMERGÊNCIA
            </h2>
            <p className="text-muted-foreground mb-6">
              Para situações que requerem resposta imediata
            </p>
            <Button
              onClick={quickEmergency}
              className="bg-tactical-red hover:bg-tactical-red/90 h-12 px-8"
              size="lg"
              disabled={!activeRoundId}
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              ACIONAR EMERGÊNCIA
            </Button>
          </CardContent>
        </Card>

        {/* Location Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Navigation className="w-5 h-5 text-tactical-blue" />
                <div>
                  <p className="font-medium">Localização GPS</p>
                  <p className="text-sm text-muted-foreground">
                    {currentLocation ? 
                      `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}` :
                      'Aguardando localização...'}
                  </p>
                </div>
              </div>
              {!currentLocation && (
                <Button onClick={getCurrentLocation} size="sm" variant="outline">
                  Atualizar GPS
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        <Card>
          <CardHeader>
            <CardTitle>Incidentes Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum incidente reportado hoje</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{incident.title}</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {getIncidentTypeLabel(incident.type)}
                        </Badge>
                        <Badge className={getPriorityColor(incident.priority)}>
                          {incident.priority.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    {incident.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {incident.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatTime(incident.reported_at)}</span>
                      <div className="flex items-center space-x-2">
                        <span>Status: {incident.status}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(incident)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report Dialog using IncidentDialog */}
      {reportDialogOpen && activeRoundId && (
        <IncidentDialog
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          roundId={activeRoundId}
          currentLocation={currentLocation}
          onSuccess={handleIncidentReported}
        />
      )}

      {/* Details Dialog */}
      {detailsDialogOpen && selectedIncident && (
        <IncidentDetailsDialog
          open={detailsDialogOpen}
          onClose={() => setDetailsDialogOpen(false)}
          incident={selectedIncident}
        />
      )}
    </div>
  );
};

export default TacticIncident;