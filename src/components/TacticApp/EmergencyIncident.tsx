import { useState, useEffect } from "react";
import { AlertTriangle, MapPin, Navigation, CheckCircle, Clock, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EmergencyIncidentType = {
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
};

const EmergencyIncident = () => {
  const [incidents, setIncidents] = useState<EmergencyIncidentType[]>([]);
  const [currentIncident, setCurrentIncident] = useState<EmergencyIncidentType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "emergency",
    priority: "high",
    target_lat: "",
    target_lng: "",
    photo: null as File | null
  });
  const [resolveData, setResolveData] = useState({
    resolution: "",
    actions_taken: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveIncidents();
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const fetchActiveIncidents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("round_id", "00000000-0000-0000-0000-000000000000") // Buscar ocorrências imediatas
        .in('status', ['open', 'investigating'])
        .order("reported_at", { ascending: false });

      if (error) throw error;
      
      const incidentsData = (data || []).map(incident => ({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        type: incident.type,
        priority: incident.priority,
        status: incident.status,
        lat: incident.lat,
        lng: incident.lng,
        reported_at: incident.reported_at,
        round_id: incident.round_id
      }));
      
      setIncidents(incidentsData);
      
      // Se há um incidente ativo, definir como atual
      const activeIncident = incidentsData.find(i => i.status === 'open');
      if (activeIncident && !currentIncident) {
        setCurrentIncident(activeIncident);
        startLocationTracking();
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
    }
  };

  const startLocationTracking = () => {
    if (navigator.geolocation && !trackingLocation) {
      setTrackingLocation(true);
      
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(newLocation);
          
          // Salvar ponto da rota se há incidente ativo
          if (currentIncident) {
            saveRoutePoint(newLocation);
          }
        },
        (error) => {
          console.error("Erro ao obter localização:", error);
          toast({
            title: "Erro de Localização",
            description: "Não foi possível obter sua localização atual",
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000
        }
      );
      
      setWatchId(id);
    }
  };

  const stopLocationTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setTrackingLocation(false);
  };

  const saveRoutePoint = async (location: { lat: number; lng: number }) => {
    if (!currentIncident) return;

    try {
      await supabase
        .from("route_points")
        .insert([{
          round_id: currentIncident.round_id,
          lat: location.lat,
          lng: location.lng,
          speed: 0
        }]);
    } catch (error) {
      console.error("Error saving route point:", error);
    }
  };

  const createEmergencyIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Get current location or use default
      let locationData = { lat: 0, lng: 0 };
      if (currentLocation) {
        locationData = currentLocation;
      } else {
        // Try to get location now
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
        } catch (locationError) {
          console.warn("Could not get location, using default");
        }
      }

      const incidentData = {
        round_id: "00000000-0000-0000-0000-000000000000",
        title: formData.title || "EMERGÊNCIA IMEDIATA",
        description: formData.description || `Emergência reportada via app móvel. Localização: ${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`,
        type: 'emergency' as const,
        priority: 'critical' as const,
        status: 'open',
        lat: locationData.lat,
        lng: locationData.lng
      };

      const { data, error } = await supabase
        .from("incidents")
        .insert([incidentData])
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        throw new Error(`Erro na base de dados: ${error.message}`);
      }

      setCurrentIncident(data);
      startLocationTracking();

      toast({
        title: "🚨 EMERGÊNCIA ATIVADA",
        description: "Emergência reportada com sucesso! Administradores foram notificados.",
      });

      setDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        type: "emergency",
        priority: "high",
        target_lat: "",
        target_lng: "",
        photo: null
      });

      fetchActiveIncidents();
    } catch (error) {
      console.error("Error creating emergency incident:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar emergência",
        variant: "destructive",
      });
    }
  };

  const updateIncidentStatus = async (newStatus: 'investigating' | 'resolved') => {
    if (!currentIncident) return;

    try {
      const { error } = await supabase
        .from("incidents")
        .update({ status: newStatus })
        .eq("id", currentIncident.id);

      if (error) throw error;

      if (newStatus === 'resolved') {
        setCurrentIncident(null);
        stopLocationTracking();
      } else {
        setCurrentIncident({ ...currentIncident, status: newStatus });
      }

      toast({
        title: "Status Atualizado",
        description: newStatus === 'investigating' ? 
          "Ocorrência em investigação" : 
          "Ocorrência resolvida com sucesso",
      });

      fetchActiveIncidents();
    } catch (error) {
      console.error("Error updating incident status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da ocorrência",
        variant: "destructive",
      });
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-tactical-red text-white';
      case 'investigating': return 'bg-tactical-amber text-white';
      case 'resolved': return 'bg-tactical-green text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberta';
      case 'investigating': return 'Investigando';
      case 'resolved': return 'Resolvida';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-tactical-red">Criar Ocorrência</h2>
          <p className="text-muted-foreground">
            Sistema de resposta rápida para emergências
          </p>
        </div>
        
        <Button 
          onClick={() => setDialogOpen(true)}
          className="bg-tactical-red hover:bg-tactical-red/90"
          disabled={!currentLocation}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Reportar Emergência
        </Button>
      </div>

      {/* Status da localização */}
      <Card className="border-tactical-amber">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${trackingLocation ? 'bg-tactical-green/20' : 'bg-muted'}`}>
                <Navigation className={`w-5 h-5 ${trackingLocation ? 'text-tactical-green' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium">
                  {trackingLocation ? 'Localização Ativa' : 'Localização Inativa'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentLocation ? 
                    `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}` :
                    'Aguardando localização...'}
                </p>
              </div>
            </div>
            {!trackingLocation && (
              <Button onClick={startLocationTracking} size="sm">
                Ativar GPS
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para nova ocorrência */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Ocorrência</DialogTitle>
          </DialogHeader>
          <form onSubmit={createEmergencyIncident} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Ocorrência</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Invasão detectada"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Detalhes (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva a situação em detalhes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Foto da Ocorrência</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFormData({ ...formData, photo: e.target.files?.[0] || null })}
                className="cursor-pointer"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="w-4 h-4" />
                <span>Tire uma foto para documentar a ocorrência</span>
              </div>
            </div>
            
            <Button type="submit" className="w-full bg-tactical-red hover:bg-tactical-red/90">
              Criar Ocorrência
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmergencyIncident;