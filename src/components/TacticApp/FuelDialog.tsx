import { useState, useEffect } from "react";
import { Fuel, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FuelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId?: string;
  roundId?: string;
  currentOdometer?: number;
}

const FuelDialog = ({ open, onOpenChange, vehicleId, roundId, currentOdometer }: FuelDialogProps) => {
  const [fuelData, setFuelData] = useState({
    vehicle_id: vehicleId || "",
    fuel_amount: "",
    fuel_cost: "",
    fuel_station: "",
    odometer_reading: currentOdometer?.toString() || "",
    notes: ""
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchVehicles();
    }
  }, [open]);

  useEffect(() => {
    if (vehicleId) {
      setFuelData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("active", true)
        .order("license_plate");

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const handleSubmit = async () => {
    if (!fuelData.vehicle_id) {
      toast({
        title: "Erro",
        description: "Nenhum veículo selecionado",
        variant: "destructive",
      });
      return;
    }

    if (!fuelData.fuel_amount || !fuelData.odometer_reading) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a quantidade de combustível e odômetro",
        variant: "destructive",
      });
      return;
    }

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

      // Validar odômetro usando a função RPC (cross-source validation)
      const { data: validationData, error: validationError } = await supabase.rpc(
        'validate_odometer_reading',
        {
          p_vehicle_id: fuelData.vehicle_id,
          p_new_km: parseInt(fuelData.odometer_reading)
        }
      );

      if (validationError) throw validationError;
      
      const validation = validationData as any;
      
      if (!validation.valid) {
        toast({
          title: "Erro de Validação",
          description: validation.message,
          variant: "destructive",
        });
        return;
      }

      const fuelLog = {
        vehicle_id: fuelData.vehicle_id,
        round_id: roundId || null,
        fuel_amount: parseFloat(fuelData.fuel_amount),
        fuel_cost: fuelData.fuel_cost ? parseFloat(fuelData.fuel_cost) : null,
        fuel_station: fuelData.fuel_station || null,
        odometer_reading: parseInt(fuelData.odometer_reading),
        created_by: user.id,
      };

      const { error } = await supabase
        .from("vehicle_fuel_logs")
        .insert([fuelLog]);

      if (error) throw error;

      // Update vehicle odometer if provided
      if (fuelData.vehicle_id && fuelData.odometer_reading) {
        const { error: vehicleError } = await supabase
          .from("vehicles")
          .update({ 
            current_odometer: parseInt(fuelData.odometer_reading),
            updated_at: new Date().toISOString()
          })
          .eq("id", fuelData.vehicle_id);

        if (vehicleError) {
          console.error("Error updating vehicle odometer:", vehicleError);
        }
      }

      toast({
        title: "Abastecimento registrado",
        description: `${fuelData.fuel_amount}L registrados com sucesso`,
      });

      // Reset form
      setFuelData({
        vehicle_id: "",
        fuel_amount: "",
        fuel_cost: "",
        fuel_station: "",
        odometer_reading: "",
        notes: ""
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving fuel log:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar abastecimento",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-blue-500" />
            Registrar Abastecimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Vehicle Selection */}
          <div>
            <Label htmlFor="vehicle">Veículo *</Label>
            <Select 
              value={fuelData.vehicle_id} 
              onValueChange={(value) => setFuelData(prev => ({ ...prev, vehicle_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.license_plate} - {vehicle.brand} {vehicle.model} ({vehicle.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fuel_amount">Quantidade (L) *</Label>
              <Input
                id="fuel_amount"
                type="number"
                step="0.01"
                placeholder="Ex: 45.50"
                value={fuelData.fuel_amount}
                onChange={(e) => setFuelData(prev => ({ ...prev, fuel_amount: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="fuel_cost">Valor (R$)</Label>
              <Input
                id="fuel_cost"
                type="number"
                step="0.01"
                placeholder="Ex: 280.50"
                value={fuelData.fuel_cost}
                onChange={(e) => setFuelData(prev => ({ ...prev, fuel_cost: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="odometer_reading">Odômetro (km) *</Label>
            <Input
              id="odometer_reading"
              type="number"
              placeholder="Ex: 125430"
              value={fuelData.odometer_reading}
              onChange={(e) => setFuelData(prev => ({ ...prev, odometer_reading: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="fuel_station">Posto de Combustível</Label>
            <Input
              id="fuel_station"
              placeholder="Ex: Shell, Petrobras..."
              value={fuelData.fuel_station}
              onChange={(e) => setFuelData(prev => ({ ...prev, fuel_station: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais..."
              value={fuelData.notes}
              onChange={(e) => setFuelData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-tactical-blue hover:bg-tactical-blue/90"
            >
              <Save className="w-4 h-4 mr-2" />
              Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FuelDialog;