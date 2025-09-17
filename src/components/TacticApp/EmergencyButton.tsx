import { useState, useEffect } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EmergencyButton = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [formData, setFormData] = useState({
    title: "EMERGÊNCIA IMEDIATA",
    description: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    // Get current location when component mounts
    getCurrentLocation();
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
        }
      );
    }
  };

  const handleEmergencyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
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

      // Use current location or get it now
      let locationData = currentLocation;
      if (!locationData) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true
            });
          });
          locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        } catch (locationError) {
          console.warn("Could not get location");
          locationData = { lat: 0, lng: 0 }; // Default location
        }
      }

      const incidentData = {
        round_id: "00000000-0000-0000-0000-000000000000",
        title: formData.title,
        description: formData.description || `Emergência reportada via app móvel. Localização: ${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`,
        type: 'emergency' as const,
        priority: 'critical' as const,
        status: 'open',
        lat: locationData.lat,
        lng: locationData.lng
      };

      const { error } = await supabase
        .from("incidents")
        .insert([incidentData]);

      if (error) {
        console.error("Database error:", error);
        throw new Error(`Erro na base de dados: ${error.message}`);
      }

      toast({
        title: "🚨 EMERGÊNCIA REPORTADA",
        description: "Emergência enviada com sucesso! Administradores foram notificados.",
      });

      setDialogOpen(false);
      setFormData({
        title: "EMERGÊNCIA IMEDIATA",
        description: ""
      });

    } catch (error) {
      console.error("Error reporting emergency:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao reportar emergência",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        className="bg-tactical-red hover:bg-tactical-red/90 text-white font-bold"
        size="lg"
      >
        <AlertTriangle className="w-5 h-5 mr-2" />
        EMERGÊNCIA
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-tactical-red flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              EMERGÊNCIA IMEDIATA
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEmergencyReport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Descrição do Incidente</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="EMERGÊNCIA IMEDIATA"
                className="border-tactical-red focus:border-tactical-red"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Detalhes (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Situação de emergência - necessita resposta imediata"
                rows={3}
                className="border-tactical-red focus:border-tactical-red"
              />
            </div>

            {currentLocation && (
              <div className="text-sm text-muted-foreground">
                📍 Localização: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </div>
            )}
            
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-tactical-red hover:bg-tactical-red/90"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </div>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    ENVIAR EMERGÊNCIA
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmergencyButton;