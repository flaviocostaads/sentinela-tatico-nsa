import { useState, useEffect } from "react";
import { Car, Bike, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VehicleSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onVehicleSelected: (vehicleId: string | null, vehicleType: 'car' | 'motorcycle' | 'on_foot' | null, vehiclePlate?: string) => void;
}

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  type: 'car' | 'motorcycle' | 'on_foot';
}

const VehicleSelectionDialog = ({ open, onClose, onVehicleSelected }: VehicleSelectionDialogProps) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<'vehicle' | 'on_foot'>('vehicle');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchVehicles();
    }
  }, [open]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('active', true)
        .order('license_plate');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar veículos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getVehicleIcon = (type: 'car' | 'motorcycle' | 'on_foot') => {
    switch (type) {
      case 'car':
        return <Car className="w-4 h-4" />;
      case 'motorcycle':
        return <Bike className="w-4 h-4" />;
      default:
        return <Car className="w-4 h-4" />;
    }
  };

  const handleConfirm = () => {
    if (selectedMode === 'on_foot') {
      onVehicleSelected(null, 'on_foot');
    } else if (selectedVehicleId) {
      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (vehicle) {
        onVehicleSelected(vehicle.id, vehicle.type, vehicle.license_plate);
      }
    }
  };

  const canConfirm = selectedMode === 'on_foot' || (selectedMode === 'vehicle' && selectedVehicleId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecione o Modo da Ronda</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Como você fará a ronda?</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={selectedMode === 'vehicle' ? 'default' : 'outline'}
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => setSelectedMode('vehicle')}
              >
                <Car className="w-6 h-6" />
                <span>Com Veículo</span>
              </Button>
              
              <Button
                type="button"
                variant={selectedMode === 'on_foot' ? 'default' : 'outline'}
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => setSelectedMode('on_foot')}
              >
                <Footprints className="w-6 h-6" />
                <span>A Pé</span>
              </Button>
            </div>
          </div>

          {/* Vehicle Selection - only show if vehicle mode is selected */}
          {selectedMode === 'vehicle' && (
            <div className="space-y-2">
              <Label htmlFor="vehicle">Selecione o Veículo *</Label>
              <Select
                value={selectedVehicleId}
                onValueChange={setSelectedVehicleId}
                disabled={loading}
              >
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      <div className="flex items-center gap-2">
                        {getVehicleIcon(vehicle.type)}
                        <span>{vehicle.license_plate} - {vehicle.brand} {vehicle.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedMode === 'on_foot' && (
            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              <p>Você iniciará a ronda a pé. Não será necessário registrar odômetro.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            
            <Button
              className="flex-1 bg-tactical-green hover:bg-tactical-green/90"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleSelectionDialog;
