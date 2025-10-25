import { useState, useEffect } from "react";
import { Car, Bike, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  type: 'car' | 'motorcycle' | 'on_foot';
  current_odometer: number;
}

interface VehicleSelectionStepProps {
  onVehicleSelect: (vehicleId: string | null, vehicleType: 'car' | 'motorcycle' | 'foot') => void;
}

const VehicleSelectionStep = ({ onVehicleSelect }: VehicleSelectionStepProps) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("active", true)
        .order("license_plate", { ascending: true });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar veículos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSelect = (vehicleId: string, vehicleType: 'car' | 'motorcycle' | 'foot') => {
    setSelectedVehicleId(vehicleId);
    if (vehicleType === 'foot') {
      onVehicleSelect(null, vehicleType);
    } else {
      onVehicleSelect(vehicleId, vehicleType);
    }
  };

  const handleOnFoot = () => {
    setSelectedVehicleId('foot');
    onVehicleSelect(null, 'foot');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold mb-2">Selecione o Veículo</h3>
        <p className="text-sm text-muted-foreground">
          Escolha o veículo para inspeção ou marque "A pé"
        </p>
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto">
        {vehicles.filter(v => v.type !== 'on_foot').map((vehicle) => (
          <Card
            key={vehicle.id}
            className={`cursor-pointer transition-all hover:border-primary ${
              selectedVehicleId === vehicle.id
                ? 'border-2 border-primary bg-primary/5'
                : 'border'
            }`}
            onClick={() => handleVehicleSelect(vehicle.id, vehicle.type as 'car' | 'motorcycle')}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                  vehicle.type === 'car' ? 'bg-tactical-blue/10' : 'bg-tactical-green/10'
                }`}>
                  {vehicle.type === 'car' ? (
                    <Car className="w-7 h-7 text-tactical-blue" />
                  ) : (
                    <Bike className="w-7 h-7 text-tactical-green" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-lg">{vehicle.license_plate}</h4>
                    <Badge variant="outline" className="text-xs">
                      {vehicle.type === 'car' ? 'Carro' : 'Moto'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {vehicle.brand} {vehicle.model}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Odômetro: {vehicle.current_odometer.toLocaleString()} km
                  </p>
                </div>

                {selectedVehicleId === vehicle.id && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* On Foot Option */}
        <Card
          className={`cursor-pointer transition-all hover:border-primary ${
            selectedVehicleId === 'foot'
              ? 'border-2 border-primary bg-primary/5'
              : 'border'
          }`}
          onClick={handleOnFoot}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-tactical-amber/10 rounded-lg flex items-center justify-center">
                <User2 className="w-7 h-7 text-tactical-amber" />
              </div>
              
              <div className="flex-1">
                <h4 className="font-semibold text-lg">A Pé</h4>
                <p className="text-sm text-muted-foreground">
                  Ronda sem veículo
                </p>
              </div>

              {selectedVehicleId === 'foot' && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {vehicles.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum veículo disponível</h3>
            <p className="text-muted-foreground">
              Entre em contato com o administrador para adicionar veículos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VehicleSelectionStep;
