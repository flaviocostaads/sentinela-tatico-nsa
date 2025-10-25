import { useState, useEffect } from 'react';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Fuel, Save, Car, Bike, TrendingUp } from 'lucide-react';
import { useFuelConfig } from '@/hooks/useFuelConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  type: string;
  fuel_efficiency: number | null;
  fuel_type: string;
  fuel_capacity: number | null;
}

export default function FuelConfiguration() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const { fuelPrices, getFuelPrice, updateFuelPrice } = useFuelConfig();
  const { toast } = useToast();
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    const prices: Record<string, string> = {};
    fuelPrices.forEach(fp => {
      prices[fp.fuel_type] = fp.price_per_liter.toFixed(2);
    });
    setEditingPrices(prices);
  }, [fuelPrices]);

  const fetchVehicles = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFuelPrices = async () => {
    for (const [fuelType, price] of Object.entries(editingPrices)) {
      await updateFuelPrice(fuelType, parseFloat(price));
    }
  };

  const handleUpdateVehicle = async (vehicleId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', vehicleId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Veículo atualizado"
      });

      fetchVehicles();
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar veículo",
        variant: "destructive"
      });
    }
  };

  const calculateFullTankCost = (vehicle: Vehicle): string => {
    if (!vehicle.fuel_capacity) return 'N/A';
    const price = getFuelPrice(vehicle.fuel_type);
    const cost = vehicle.fuel_capacity * price;
    return `R$ ${cost.toFixed(2)}`;
  };

  const getFuelTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      gasoline: 'Gasolina',
      diesel: 'Diesel',
      ethanol: 'Etanol',
      electric: 'Elétrico'
    };
    return labels[type] || type;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Fuel className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Configuração de Combustível</h1>
              <p className="text-muted-foreground">Gerencie preços e consumo dos veículos</p>
            </div>
          </div>

          {/* Seção de Preços de Combustível */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Preços de Combustível
              </CardTitle>
              <CardDescription>Atualize os preços atuais do mercado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {fuelPrices.map(fuel => (
                  <div key={fuel.fuel_type} className="space-y-2">
                    <Label>{getFuelTypeLabel(fuel.fuel_type)}</Label>
                    <div className="flex gap-2">
                      <span className="flex items-center">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPrices[fuel.fuel_type] || ''}
                        onChange={(e) => setEditingPrices({
                          ...editingPrices,
                          [fuel.fuel_type]: e.target.value
                        })}
                        className="flex-1"
                      />
                      <span className="flex items-center text-muted-foreground">/L</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveFuelPrices} className="w-full md:w-auto">
                <Save className="w-4 h-4 mr-2" />
                Salvar Preços
              </Button>
            </CardContent>
          </Card>

          {/* Seção de Veículos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5" />
                Eficiência dos Veículos
              </CardTitle>
              <CardDescription>Configure consumo e capacidade de cada veículo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-center text-muted-foreground">Carregando veículos...</p>
              ) : vehicles.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhum veículo cadastrado</p>
              ) : (
                vehicles.map(vehicle => (
                  <Card key={vehicle.id} className="bg-card/50">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center gap-3">
                        {vehicle.type === 'motorcycle' ? (
                          <Bike className="w-6 h-6 text-primary" />
                        ) : (
                          <Car className="w-6 h-6 text-primary" />
                        )}
                        <div>
                          <h3 className="font-semibold">{vehicle.license_plate}</h3>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.brand} {vehicle.model}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Consumo Médio (km/L)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="Ex: 12.5"
                            defaultValue={vehicle.fuel_efficiency || ''}
                            onBlur={(e) => {
                              const value = parseFloat(e.target.value);
                              if (value) {
                                handleUpdateVehicle(vehicle.id, { fuel_efficiency: value });
                              }
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Tipo de Combustível</Label>
                          <Select
                            defaultValue={vehicle.fuel_type}
                            onValueChange={(value) => handleUpdateVehicle(vehicle.id, { fuel_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gasoline">Gasolina</SelectItem>
                              <SelectItem value="diesel">Diesel</SelectItem>
                              <SelectItem value="ethanol">Etanol</SelectItem>
                              <SelectItem value="electric">Elétrico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Capacidade do Tanque (L)</Label>
                          <Input
                            type="number"
                            step="1"
                            placeholder="Ex: 50"
                            defaultValue={vehicle.fuel_capacity || ''}
                            onBlur={(e) => {
                              const value = parseFloat(e.target.value);
                              if (value) {
                                handleUpdateVehicle(vehicle.id, { fuel_capacity: value });
                              }
                            }}
                          />
                        </div>
                      </div>

                      {vehicle.fuel_capacity && (
                        <div className="flex items-center gap-2 pt-2">
                          <Badge variant="secondary" className="text-sm">
                            Tanque Cheio: {calculateFullTankCost(vehicle)}
                          </Badge>
                          {vehicle.fuel_efficiency && (
                            <Badge variant="outline" className="text-sm">
                              Autonomia: ~{(vehicle.fuel_capacity * vehicle.fuel_efficiency).toFixed(0)} km
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
