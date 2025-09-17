import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Fuel, Wrench, AlertTriangle, Clock, Plus, X } from "lucide-react";

interface MaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId?: string;
  roundId?: string;
  currentOdometer?: number;
}

const MaintenanceDialog = ({ open, onOpenChange, vehicleId, roundId, currentOdometer }: MaintenanceDialogProps) => {
  const [maintenanceData, setMaintenanceData] = useState({
    vehicle_id: vehicleId || "",
    maintenance_type: "",
    service_type: "",
    description: "",
    location: "",
    odometer_reading: currentOdometer || 0,
    cost: 0,
    service_provider: ""
  });
  const [partsReplaced, setPartsReplaced] = useState<string[]>([]);
  const [newPart, setNewPart] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchVehicles();
    }
  }, [open]);

  useEffect(() => {
    if (vehicleId) {
      setMaintenanceData(prev => ({ ...prev, vehicle_id: vehicleId }));
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

  const addPart = () => {
    if (newPart.trim() && !partsReplaced.includes(newPart.trim())) {
      setPartsReplaced([...partsReplaced, newPart.trim()]);
      setNewPart("");
    }
  };

  const removePart = (index: number) => {
    setPartsReplaced(partsReplaced.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!maintenanceData.vehicle_id) {
      toast({
        title: "Erro",
        description: "Veículo não selecionado",
        variant: "destructive",
      });
      return;
    }

    if (!maintenanceData.maintenance_type) {
      toast({
        title: "Erro",
        description: "Selecione o tipo de manutenção",
        variant: "destructive",
      });
      return;
    }

    if (!maintenanceData.service_type) {
      toast({
        title: "Erro", 
        description: "Selecione o tipo de serviço",
        variant: "destructive",
      });
      return;
    }

    if (!maintenanceData.description.trim()) {
      toast({
        title: "Erro",
        description: "Descrição é obrigatória",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const logData = {
        vehicle_id: maintenanceData.vehicle_id,
        round_id: roundId || null,
        created_by: user.id,
        maintenance_type: maintenanceData.maintenance_type,
        service_type: maintenanceData.service_type,
        description: maintenanceData.description,
        location: maintenanceData.location || null,
        odometer_reading: maintenanceData.odometer_reading,
        cost: maintenanceData.cost > 0 ? maintenanceData.cost : null,
        parts_replaced: partsReplaced.length > 0 ? partsReplaced : null,
        service_provider: maintenanceData.service_provider || null,
        end_time: new Date().toISOString()
      };

      console.log("Maintenance log data being inserted:", logData);

      const { error } = await supabase
        .from("vehicle_maintenance_logs")
        .insert([logData]);

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      // Update vehicle odometer if needed
      if (maintenanceData.odometer_reading > (currentOdometer || 0)) {
        await supabase
          .from("vehicles")
          .update({ current_odometer: maintenanceData.odometer_reading })
          .eq("id", maintenanceData.vehicle_id);
      }

      toast({
        title: "Sucesso",
        description: "Manutenção registrada com sucesso!",
      });

      onOpenChange(false);
      setMaintenanceData({
        vehicle_id: "",
        maintenance_type: "",
        service_type: "",
        description: "",
        location: "",
        odometer_reading: currentOdometer || 0,
        cost: 0,
        service_provider: ""
      });
      setPartsReplaced([]);
      setNewPart("");
    } catch (error) {
      console.error("Error creating maintenance log:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar manutenção",
        variant: "destructive",
      });
    }
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'fuel': return Fuel;
      case 'tire_change':
      case 'oil_change':
      case 'repair': return Wrench;
      default: return AlertTriangle;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wrench className="w-5 h-5" />
            <span>Registrar Manutenção</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle Selection */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">Veículo *</Label>
            <Select 
              value={maintenanceData.vehicle_id} 
              onValueChange={(value) => setMaintenanceData({ ...maintenanceData, vehicle_id: value })}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maintenance_type">Tipo de Manutenção</Label>
              <Select 
                value={maintenanceData.maintenance_type} 
                onValueChange={(value) => setMaintenanceData({ ...maintenanceData, maintenance_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="preditiva">Preditiva</SelectItem>
                  <SelectItem value="emergencial">Emergencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="service_type">Serviço</Label>
              <Select 
                value={maintenanceData.service_type} 
                onValueChange={(value) => setMaintenanceData({ ...maintenanceData, service_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="troca_oleo">Troca de Óleo</SelectItem>
                  <SelectItem value="troca_pneus">Troca de Pneu</SelectItem>
                  <SelectItem value="freios">Freios</SelectItem>
                  <SelectItem value="motor">Motor</SelectItem>
                  <SelectItem value="transmissao">Transmissão</SelectItem>
                  <SelectItem value="eletrica">Elétrica</SelectItem>
                  <SelectItem value="suspensao">Suspensão</SelectItem>
                  <SelectItem value="ar_condicionado">Ar Condicionado</SelectItem>
                  <SelectItem value="revisao_geral">Revisão Geral</SelectItem>
                  <SelectItem value="outros">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={maintenanceData.description}
              onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })}
              placeholder="Descreva o serviço realizado..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <Input
                id="location"
                value={maintenanceData.location}
                onChange={(e) => setMaintenanceData({ ...maintenanceData, location: e.target.value })}
                placeholder="Local da manutenção"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="odometer_reading">Quilometragem</Label>
              <Input
                id="odometer_reading"
                type="number"
                value={maintenanceData.odometer_reading}
                onChange={(e) => setMaintenanceData({ ...maintenanceData, odometer_reading: parseInt(e.target.value) })}
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Custo (R$)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={maintenanceData.cost}
                onChange={(e) => setMaintenanceData({ ...maintenanceData, cost: parseFloat(e.target.value) })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="service_provider">Prestador de Serviço</Label>
              <Input
                id="service_provider"
                value={maintenanceData.service_provider}
                onChange={(e) => setMaintenanceData({ ...maintenanceData, service_provider: e.target.value })}
                placeholder="Nome da oficina/posto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Peças Substituídas</Label>
            
            {/* Lista de peças adicionadas */}
            {partsReplaced.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {partsReplaced.map((part, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {part}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removePart(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Input para nova peça */}
            <div className="flex gap-2">
              <Input
                value={newPart}
                onChange={(e) => setNewPart(e.target.value)}
                placeholder="Digite o nome da peça..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPart())}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPart}
                disabled={!newPart.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-tactical-green hover:bg-tactical-green/90">
              Registrar Manutenção
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaintenanceDialog;