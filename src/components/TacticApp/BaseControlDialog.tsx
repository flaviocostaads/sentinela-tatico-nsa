import { useState } from "react";
import { Camera, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BaseControlDialogProps {
  open: boolean;
  onClose: () => void;
  type: 'departure' | 'arrival';
  roundId: string;
  onComplete: () => void;
}

const BaseControlDialog = ({ open, onClose, type, roundId, onComplete }: BaseControlDialogProps) => {
  const [odometerReading, setOdometerReading] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePhotoCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setPhoto(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const handleSubmit = async () => {
    if (!odometerReading) {
      toast({
        title: "Erro",
        description: "Informe a leitura do odômetro",
        variant: "destructive",
      });
      return;
    }

    if (!photo) {
      toast({
        title: "Erro", 
        description: "Tire uma foto do odômetro",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get current location
      const location = await new Promise<{lat: number, lng: number}>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }),
          reject,
          { enableHighAccuracy: true }
        );
      });

      // Upload photo to storage
      const photoFile = await fetch(photo).then(r => r.blob());
      const fileName = `odometer-${type}-${roundId}-${Date.now()}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('odometer-photos')
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('odometer-photos')
        .getPublicUrl(fileName);

      // Create odometer record
      const { error: odometerError } = await supabase
        .from('odometer_records')
        .insert({
          round_id: roundId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          odometer_reading: parseInt(odometerReading),
          photo_url: publicUrl,
          record_type: type === 'departure' ? 'round_start' : 'round_end',
          recorded_at: new Date().toISOString()
        });

      if (odometerError) throw odometerError;

      // Update round with odometer reading
      const updateData = type === 'departure' 
        ? { 
            start_odometer: parseInt(odometerReading),
            status: 'active' as const,
            start_time: new Date().toISOString()
          }
        : { 
            end_odometer: parseInt(odometerReading),
            status: 'completed' as const,
            end_time: new Date().toISOString()
          };

      const { error: updateError } = await supabase
        .from('rounds')
        .update(updateData)
        .eq('id', roundId);

      if (updateError) throw updateError;

      // Save location for tracking
      const { error: locationError } = await supabase
        .from('user_locations')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          round_id: roundId,
          lat: location.lat,
          lng: location.lng,
          recorded_at: new Date().toISOString(),
          is_active: true
        });

      if (locationError) throw locationError;

      toast({
        title: type === 'departure' ? "Saída da base registrada" : "Chegada na base registrada",
        description: `Odômetro: ${odometerReading} km`,
      });

      onComplete();
      onClose();
    } catch (error) {
      console.error('Error saving base control:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar " + (type === 'departure' ? "saída" : "chegada"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {type === 'departure' ? 'Saída da Base' : 'Chegada na Base'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="odometer">Leitura do Odômetro (km)</Label>
            <Input
              id="odometer"
              type="number"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              placeholder="Ex: 45120"
            />
          </div>

          <div>
            <Label>Foto do Odômetro</Label>
            <div className="mt-2">
              {photo ? (
                <div className="relative">
                  <img src={photo} alt="Odometer" className="w-full h-32 object-cover rounded" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoCapture}
                    className="mt-2 w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Alterar Foto
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={handlePhotoCapture}
                  className="w-full h-32 border-dashed"
                >
                  <Camera className="w-6 h-6 mr-2" />
                  Tirar Foto do Odômetro
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="observations">Observações (opcional)</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Observações sobre a saída/chegada..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? "Salvando..." : type === 'departure' ? "Registrar Saída" : "Registrar Chegada"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BaseControlDialog;