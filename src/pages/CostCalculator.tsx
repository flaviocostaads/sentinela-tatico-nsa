import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, Save, Map, History } from "lucide-react";
import { useCostCalculator, CostCalculationInput, CostCalculationResult } from "@/hooks/useCostCalculator";
import { useFuelConfig } from "@/hooks/useFuelConfig";
import { useBaseLocation } from "@/hooks/useBaseLocation";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResultsDisplay } from "@/components/CostCalculator/ResultsDisplay";
import { CalculationHistory } from "@/components/CostCalculator/CalculationHistory";
import { MapSelector } from "@/components/CostCalculator/MapSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

export default function CostCalculator() {
  const { toast } = useToast();
  const { calculateCosts, saveCalculation, loading } = useCostCalculator();
  const { getFuelPrice, fuelPrices } = useFuelConfig();
  const { base } = useBaseLocation();
  
  const [showMap, setShowMap] = useState(false);
  const [calculatedResults, setCalculatedResults] = useState<CostCalculationResult | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<CostCalculationInput>({
    calculation_name: "",
    client_name: "",
    vehicle_type: "car",
    fuel_type: "gasoline",
    fuel_price_per_liter: 5.5,
    fuel_efficiency: 10,
    distance_base_to_client: 0,
    rounds_per_day: 3,
    time_per_round: 2,
    days_per_month: 22,
    tactical_salary: 2500,
    other_monthly_costs: 300,
    profit_margin: 30,
  });

  useEffect(() => {
    fetchClients();
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (base) {
      setFormData((prev) => ({
        ...prev,
        base_location: {
          lat: base.lat,
          lng: base.lng,
          name: base.name,
          address: base.address,
        },
      }));
    }
  }, [base]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("active", true)
      .order("name");
    if (data) setClients(data);
  };

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .eq("active", true)
      .order("license_plate");
    if (data) setVehicles(data);
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        client_id: client.id,
        client_name: client.name,
        client_location: {
          lat: client.lat,
          lng: client.lng,
          name: client.name,
          address: client.address,
        },
      }));
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      const fuelPrice = getFuelPrice(vehicle.fuel_type);
      setFormData((prev) => ({
        ...prev,
        vehicle_id: vehicle.id,
        vehicle_type: vehicle.type,
        fuel_type: vehicle.fuel_type,
        fuel_efficiency: vehicle.fuel_efficiency || 10,
        fuel_price_per_liter: fuelPrice,
      }));
    }
  };

  const handleFuelTypeChange = (fuelType: string) => {
    const price = getFuelPrice(fuelType);
    setFormData((prev) => ({
      ...prev,
      fuel_type: fuelType,
      fuel_price_per_liter: price,
    }));
  };

  const handleCalculate = () => {
    // Validações
    if (!formData.calculation_name) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe o nome da cotação",
        variant: "destructive",
      });
      return;
    }

    if (!formData.client_name) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe o nome do cliente",
        variant: "destructive",
      });
      return;
    }

    if (formData.distance_base_to_client <= 0) {
      toast({
        title: "Distância inválida",
        description: "A distância da base até o cliente deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    const results = calculateCosts(formData);
    setCalculatedResults(results);

    // Alertas inteligentes
    if (formData.distance_base_to_client > 50) {
      toast({
        title: "⚠️ Distância Alta",
        description: "Distância muito grande, verifique a viabilidade operacional",
      });
    }

    if ((formData.profit_margin || 30) < 20) {
      toast({
        title: "⚠️ Margem Baixa",
        description: "Margem de lucro abaixo do recomendado (mínimo 20%)",
      });
    }
  };

  const handleSave = async () => {
    if (!calculatedResults) {
      toast({
        title: "Calcule primeiro",
        description: "Por favor, calcule os custos antes de salvar",
        variant: "destructive",
      });
      return;
    }

    await saveCalculation(formData);
  };

  const handleViewCalculation = (calculation: any) => {
    setFormData(calculation);
    setCalculatedResults({
      daily_distance: calculation.daily_distance,
      monthly_distance: calculation.monthly_distance,
      daily_fuel_cost: calculation.daily_fuel_cost,
      monthly_fuel_cost: calculation.monthly_fuel_cost,
      daily_labor_cost: calculation.daily_labor_cost,
      monthly_labor_cost: calculation.monthly_labor_cost,
      total_monthly_cost: calculation.total_monthly_cost,
      suggested_price: calculation.suggested_price,
      fuel_consumption_monthly: calculation.monthly_fuel_cost / calculation.fuel_price_per_liter,
      cost_per_km: calculation.total_monthly_cost / calculation.monthly_distance,
      hourly_rate_calculated: calculation.hourly_rate || calculation.tactical_salary / 220,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">🧮 Calculadora de Custo de Ronda</h1>
                <p className="text-muted-foreground">
                  Calcule custos operacionais e valores de cobrança para clientes
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowMap(!showMap)}>
                <Map className="h-4 w-4 mr-2" />
                {showMap ? "Ocultar Mapa" : "Ver Mapa"}
              </Button>
            </div>

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">
            <Calculator className="h-4 w-4 mr-2" />
            Calculadora
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6">
          {showMap && (
            <MapSelector
              baseLocation={formData.base_location}
              clientLocation={formData.client_location}
              onLocationSelect={(location) => {
                setFormData((prev) => ({
                  ...prev,
                  client_location: location,
                  client_name: location.name,
                }));
              }}
              onDistanceCalculated={(distance) => {
                setFormData((prev) => ({
                  ...prev,
                  distance_base_to_client: distance,
                }));
              }}
            />
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>📝 Identificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="calculation_name">Nome da Cotação *</Label>
                  <Input
                    id="calculation_name"
                    placeholder="Ex: Proposta Cliente XYZ - Nov/2024"
                    value={formData.calculation_name}
                    onChange={(e) =>
                      setFormData({ ...formData, calculation_name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Cliente</Label>
                  <Select onValueChange={handleClientSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente existente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client_name">Nome do Cliente *</Label>
                  <Input
                    id="client_name"
                    placeholder="Ou digite o nome de um novo cliente"
                    value={formData.client_name}
                    onChange={(e) =>
                      setFormData({ ...formData, client_name: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🚗 Veículo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle">Veículo Cadastrado</Label>
                  <Select onValueChange={handleVehicleSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_type">Tipo</Label>
                    <Select
                      value={formData.vehicle_type}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, vehicle_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Carro</SelectItem>
                        <SelectItem value="motorcycle">Moto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fuel_type">Combustível</Label>
                    <Select
                      value={formData.fuel_type}
                      onValueChange={handleFuelTypeChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gasoline">Gasolina</SelectItem>
                        <SelectItem value="ethanol">Etanol</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fuel_price">Preço (R$/L)</Label>
                    <Input
                      id="fuel_price"
                      type="number"
                      step="0.01"
                      value={formData.fuel_price_per_liter}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fuel_price_per_liter: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fuel_efficiency">Consumo (km/L)</Label>
                    <Input
                      id="fuel_efficiency"
                      type="number"
                      step="0.1"
                      value={formData.fuel_efficiency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fuel_efficiency: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>📍 Operação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="distance">Distância Base → Cliente (km) *</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    value={formData.distance_base_to_client}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        distance_base_to_client: parseFloat(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Somente ida (volta será calculada automaticamente)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rounds_per_day">Rondas por Dia</Label>
                  <Input
                    id="rounds_per_day"
                    type="number"
                    value={formData.rounds_per_day}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rounds_per_day: parseInt(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_per_round">Tempo por Ronda (min)</Label>
                  <Input
                    id="time_per_round"
                    type="number"
                    step="1"
                    value={Math.round(formData.time_per_round * 60)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        time_per_round: parseFloat(e.target.value) / 60,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="days_per_month">Dias no Mês</Label>
                  <Input
                    id="days_per_month"
                    type="number"
                    value={formData.days_per_month}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        days_per_month: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>💰 Custos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="salary">Salário do Tático (R$/mês)</Label>
                  <Input
                    id="salary"
                    type="number"
                    step="0.01"
                    value={formData.tactical_salary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tactical_salary: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">Valor Hora (R$/h - opcional)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    placeholder={`Auto: R$ ${(formData.tactical_salary / 220).toFixed(2)}`}
                    value={formData.hourly_rate || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hourly_rate: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="other_costs">Outros Custos Mensais (R$)</Label>
                  <Input
                    id="other_costs"
                    type="number"
                    step="0.01"
                    value={formData.other_monthly_costs}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        other_monthly_costs: parseFloat(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Seguro, depreciação, licenciamento, etc.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profit_margin">Margem de Lucro (%)</Label>
                  <Input
                    id="profit_margin"
                    type="number"
                    step="0.1"
                    value={formData.profit_margin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        profit_margin: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Anotações sobre esta cotação..."
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={handleCalculate} size="lg" className="flex-1">
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Custo
            </Button>
            {calculatedResults && (
              <Button onClick={handleSave} variant="secondary" size="lg" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Cálculo
              </Button>
            )}
          </div>

          {calculatedResults && <ResultsDisplay results={calculatedResults} />}
        </TabsContent>

        <TabsContent value="history">
          <CalculationHistory onViewCalculation={handleViewCalculation} />
        </TabsContent>
      </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
