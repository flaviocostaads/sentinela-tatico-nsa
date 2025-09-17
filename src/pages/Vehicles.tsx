import { useState, useEffect } from "react";
import { Car, Bike, Plus, Fuel, MapPin, Calendar, Wrench, Eye, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  type: 'car' | 'motorcycle';
  initial_odometer: number;
  current_odometer: number;
  fuel_capacity?: number;
  active: boolean;
  created_at: string;
}

interface VehicleStats {
  total_rounds: number;
  total_distance: number;
  fuel_consumption: number;
  last_round_date?: string;
}

const Vehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleStats, setVehicleStats] = useState<Record<string, VehicleStats>>({});
  const [loading, setLoading] = useState(true);
  const [newVehicleDialogOpen, setNewVehicleDialogOpen] = useState(false);
  const [fuelDialogOpen, setFuelDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editFormData, setEditFormData] = useState({
    license_plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    type: "",
    fuel_capacity: 0
  });
  const [formData, setFormData] = useState({
    license_plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    type: "",
    initial_odometer: 0,
    fuel_capacity: 0
  });
  const [fuelData, setFuelData] = useState({
    fuel_amount: 0,
    fuel_cost: 0,
    odometer_reading: 0,
    fuel_station: ""
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
      
      // Buscar estatísticas para cada veículo
      if (data) {
        const statsPromises = data.map(vehicle => fetchVehicleStats(vehicle.id));
        const stats = await Promise.all(statsPromises);
        const statsMap = data.reduce((acc, vehicle, index) => {
          acc[vehicle.id] = stats[index];
          return acc;
        }, {} as Record<string, VehicleStats>);
        setVehicleStats(statsMap);
      }
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

  const fetchVehicleStats = async (vehicleId: string): Promise<VehicleStats> => {
    try {
      // Buscar rondas do veículo
      const { data: rounds, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .eq("vehicle_id", vehicleId);

      if (roundsError) throw roundsError;

      // Buscar consumo de combustível
      const { data: fuelLogs, error: fuelError } = await supabase
        .from("vehicle_fuel_logs")
        .select("fuel_amount")
        .eq("vehicle_id", vehicleId);

      if (fuelError) throw fuelError;

      const totalRounds = rounds?.length || 0;
      const totalFuel = fuelLogs?.reduce((sum, log) => sum + log.fuel_amount, 0) || 0;
      const lastRound = rounds?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      return {
        total_rounds: totalRounds,
        total_distance: 0, // Será calculado baseado no odômetro
        fuel_consumption: totalFuel,
        last_round_date: lastRound?.created_at
      };
    } catch (error) {
      console.error("Error fetching vehicle stats:", error);
      return {
        total_rounds: 0,
        total_distance: 0,
        fuel_consumption: 0
      };
    }
  };

  const handleNewVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const vehicleData = {
        license_plate: formData.license_plate.toUpperCase(),
        brand: formData.brand,
        model: formData.model,
        year: formData.year,
        type: formData.type as 'car' | 'motorcycle',
        initial_odometer: formData.initial_odometer,
        current_odometer: formData.initial_odometer,
        fuel_capacity: formData.fuel_capacity > 0 ? formData.fuel_capacity : null
      };

      const { error } = await supabase
        .from("vehicles")
        .insert([vehicleData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Novo veículo cadastrado com sucesso!",
      });

      setNewVehicleDialogOpen(false);
      setFormData({
        license_plate: "",
        brand: "",
        model: "",
        year: new Date().getFullYear(),
        type: "",
        initial_odometer: 0,
        fuel_capacity: 0
      });
      fetchVehicles();
    } catch (error) {
      console.error("Error creating vehicle:", error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar novo veículo",
        variant: "destructive",
      });
    }
  };

  const handleFuelLog = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVehicle) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fuelLogData = {
        vehicle_id: selectedVehicle.id,
        fuel_amount: fuelData.fuel_amount,
        fuel_cost: fuelData.fuel_cost > 0 ? fuelData.fuel_cost : null,
        odometer_reading: fuelData.odometer_reading,
        fuel_station: fuelData.fuel_station || null,
        created_by: user.id
      };

      const { error } = await supabase
        .from("vehicle_fuel_logs")
        .insert([fuelLogData]);

      if (error) throw error;

      // Atualizar odômetro do veículo se necessário
      if (fuelData.odometer_reading > selectedVehicle.current_odometer) {
        await supabase
          .from("vehicles")
          .update({ current_odometer: fuelData.odometer_reading })
          .eq("id", selectedVehicle.id);
      }

      toast({
        title: "Sucesso",
        description: "Abastecimento registrado com sucesso!",
      });

      setFuelDialogOpen(false);
      setFuelData({
        fuel_amount: 0,
        fuel_cost: 0,
        odometer_reading: 0,
        fuel_station: ""
      });
      fetchVehicles();
    } catch (error) {
      console.error("Error creating fuel log:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar abastecimento",
        variant: "destructive",
      });
    }
  };

  const editVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditFormData({
      license_plate: vehicle.license_plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      type: vehicle.type,
      fuel_capacity: vehicle.fuel_capacity || 0
    });
    setEditDialogOpen(true);
  };

  const handleEditVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingVehicle) return;

    try {
      const vehicleData = {
        license_plate: editFormData.license_plate.toUpperCase(),
        brand: editFormData.brand,
        model: editFormData.model,
        year: editFormData.year,
        type: editFormData.type as 'car' | 'motorcycle',
        fuel_capacity: editFormData.fuel_capacity > 0 ? editFormData.fuel_capacity : null
      };

      const { error } = await supabase
        .from("vehicles")
        .update(vehicleData)
        .eq("id", editingVehicle.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Veículo atualizado com sucesso!",
      });

      setEditDialogOpen(false);
      setEditingVehicle(null);
      fetchVehicles();
    } catch (error) {
      console.error("Error updating vehicle:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar veículo",
        variant: "destructive",
      });
    }
  };

  const getVehicleIcon = (type: string) => {
    return type === 'car' ? Car : Bike;
  };

  const formatDistance = (distance: number) => {
    return `${distance.toLocaleString()} km`;
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Carregando veículos...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestão de Veículos</h1>
              <p className="text-muted-foreground">
                Controle completo da frota de veículos
              </p>
            </div>
            
            <Dialog open={newVehicleDialogOpen} onOpenChange={setNewVehicleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-tactical-green hover:bg-tactical-green/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Veículo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Veículo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleNewVehicle} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="license_plate">Placa</Label>
                      <Input
                        id="license_plate"
                        value={formData.license_plate}
                        onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                        placeholder="ABC-1234"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo</Label>
                      <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="car">Carro</SelectItem>
                          <SelectItem value="motorcycle">Moto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="brand">Marca</Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Modelo</Label>
                      <Input
                        id="model"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Ano</Label>
                      <Input
                        id="year"
                        type="number"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                        min="1990"
                        max={new Date().getFullYear()}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="initial_odometer">Km Inicial</Label>
                      <Input
                        id="initial_odometer"
                        type="number"
                        value={formData.initial_odometer}
                        onChange={(e) => setFormData({ ...formData, initial_odometer: parseInt(e.target.value) })}
                        min="0"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuel_capacity">Capacidade (L)</Label>
                      <Input
                        id="fuel_capacity"
                        type="number"
                        value={formData.fuel_capacity}
                        onChange={(e) => setFormData({ ...formData, fuel_capacity: parseFloat(e.target.value) })}
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-tactical-green hover:bg-tactical-green/90">
                    Cadastrar Veículo
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Estatísticas da frota */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Car className="w-5 h-5 text-tactical-green" />
                  <span className="text-sm text-muted-foreground">Total de Veículos</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{vehicles.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Car className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Carros</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {vehicles.filter(v => v.type === 'car').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Bike className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Motos</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {vehicles.filter(v => v.type === 'motorcycle').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Fuel className="w-4 h-4 text-tactical-amber" />
                  <span className="text-sm text-muted-foreground">Combustível Total</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {Object.values(vehicleStats).reduce((sum, stats) => sum + stats.fuel_consumption, 0).toFixed(1)}L
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de veículos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((vehicle) => {
              const Icon = getVehicleIcon(vehicle.type);
              const stats = vehicleStats[vehicle.id] || { total_rounds: 0, total_distance: 0, fuel_consumption: 0 };
              
              return (
                <Card key={vehicle.id} className="tactical-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{vehicle.license_plate}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.brand} {vehicle.model} {vehicle.year}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-tactical-green border-tactical-green">
                        Ativo
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {formatDistance(vehicle.current_odometer)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {stats.total_rounds} rondas
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Fuel className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {stats.fuel_consumption.toFixed(1)}L
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {vehicle.fuel_capacity ? `${vehicle.fuel_capacity}L` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/vehicle-details/${vehicle.id}`)}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Detalhes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editVehicle(vehicle)}
                        className="flex-1"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedVehicle(vehicle);
                          setFuelData({ 
                            ...fuelData, 
                            odometer_reading: vehicle.current_odometer 
                          });
                          setFuelDialogOpen(true);
                        }}
                      >
                        <Fuel className="w-3 h-3 mr-1" />
                        Abastecer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {vehicles.length === 0 && (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum veículo cadastrado</p>
            </div>
          )}
        </main>
      </div>

      {/* Dialog de edição de veículo */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditVehicle} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_license_plate">Placa</Label>
                <Input
                  id="edit_license_plate"
                  value={editFormData.license_plate}
                  onChange={(e) => setEditFormData({ ...editFormData, license_plate: e.target.value })}
                  placeholder="ABC-1234"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_type">Tipo</Label>
                <Select value={editFormData.type} onValueChange={(value) => setEditFormData({ ...editFormData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car">Carro</SelectItem>
                    <SelectItem value="motorcycle">Moto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_brand">Marca</Label>
                <Input
                  id="edit_brand"
                  value={editFormData.brand}
                  onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_model">Modelo</Label>
                <Input
                  id="edit_model"
                  value={editFormData.model}
                  onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                  required
                />
              </div>
            </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_year">Ano</Label>
                        <Input
                          id="edit_year"
                          type="number"
                          value={editFormData.year}
                          onChange={(e) => setEditFormData({ ...editFormData, year: parseInt(e.target.value) })}
                          min="1990"
                          max={new Date().getFullYear()}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_fuel_capacity">Capacidade do Tanque (L)</Label>
                        <Input
                          id="edit_fuel_capacity"
                          type="number"
                          value={editFormData.fuel_capacity}
                          onChange={(e) => setEditFormData({ ...editFormData, fuel_capacity: parseFloat(e.target.value) })}
                          min="0"
                          step="0.1"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" className="flex-1 bg-tactical-green hover:bg-tactical-green/90">
                        Salvar Alterações
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Dialog de abastecimento */}
              <Dialog open={fuelDialogOpen} onOpenChange={setFuelDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Abastecimento</DialogTitle>
                  </DialogHeader>
                  {selectedVehicle && (
                    <form onSubmit={handleFuelLog} className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        Veículo: <span className="font-medium">{selectedVehicle.license_plate}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fuel_amount">Quantidade (L)</Label>
                          <Input
                            id="fuel_amount"
                            type="number"
                            value={fuelData.fuel_amount}
                            onChange={(e) => setFuelData({ ...fuelData, fuel_amount: parseFloat(e.target.value) })}
                            min="0"
                            step="0.1"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fuel_cost">Valor (R$)</Label>
                          <Input
                            id="fuel_cost"
                            type="number"
                            value={fuelData.fuel_cost}
                            onChange={(e) => setFuelData({ ...fuelData, fuel_cost: parseFloat(e.target.value) })}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="odometer_reading">Odômetro (km)</Label>
                        <Input
                          id="odometer_reading"
                          type="number"
                          value={fuelData.odometer_reading}
                          onChange={(e) => setFuelData({ ...fuelData, odometer_reading: parseInt(e.target.value) })}
                          min={selectedVehicle.current_odometer}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fuel_station">Posto de Combustível</Label>
                        <Input
                          id="fuel_station"
                          value={fuelData.fuel_station}
                          onChange={(e) => setFuelData({ ...fuelData, fuel_station: e.target.value })}
                          placeholder="Nome do posto"
                        />
                      </div>

                      <Button type="submit" className="w-full bg-tactical-green hover:bg-tactical-green/90">
                        Registrar Abastecimento
                      </Button>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
    </div>
  );
};

export default Vehicles;