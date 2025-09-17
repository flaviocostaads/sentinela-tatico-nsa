import { useState, useEffect } from "react";
import { ArrowLeft, Car, Camera, Clock, TrendingUp, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  current_odometer: number;
}

interface OdometerRecord {
  id: string;
  odometer_reading: number;
  photo_url: string;
  record_type: string;
  recorded_at: string;
  profiles: {
    name: string;
  };
}

const VehicleHistory = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [records, setRecords] = useState<OdometerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (selectedVehicle) {
      fetchOdometerRecords();
    }
  }, [selectedVehicle, filterType]);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("active", true)
        .order("license_plate");

      if (error) throw error;
      setVehicles(data || []);
      
      if (data && data.length > 0) {
        setSelectedVehicle(data[0].id);
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

  const fetchOdometerRecords = async () => {
    if (!selectedVehicle) return;

    try {
      // Get odometer records
      let query = supabase
        .from("odometer_records")
        .select("*")
        .eq("vehicle_id", selectedVehicle)
        .order("recorded_at", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("record_type", filterType);
      }

      const { data: recordsData, error } = await query;
      if (error) throw error;

      if (!recordsData || recordsData.length === 0) {
        setRecords([]);
        return;
      }

      // Get user IDs for profile lookup
      const userIds = [...new Set(recordsData.map(r => r.user_id))];
      
      // Get profiles separately
      const { data: profilesData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Merge data
      const recordsWithProfiles = recordsData.map(record => ({
        ...record,
        profiles: profilesData?.find(p => p.user_id === record.user_id) || { name: "N/A" }
      }));

      setRecords(recordsWithProfiles);
    } catch (error) {
      console.error("Error fetching odometer records:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico",
        variant: "destructive",
      });
    }
  };

  const getRecordTypeLabel = (type: string) => {
    switch (type) {
      case 'start': return 'Início de Ronda';
      case 'end': return 'Fim de Ronda';
      case 'maintenance': return 'Manutenção';
      case 'fuel': return 'Abastecimento';
      default: return type;
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'start': return 'bg-tactical-blue';
      case 'end': return 'bg-tactical-green';
      case 'maintenance': return 'bg-tactical-amber';
      case 'fuel': return 'bg-purple-600';
      default: return 'bg-muted';
    }
  };

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Car className="w-6 h-6" />
                  Histórico de Veículos
                </h1>
                <p className="text-muted-foreground">
                  Controle de quilometragem e registros fotográficos
                </p>
              </div>
            </div>

            {/* Vehicle Selection and Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Veículo</label>
                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
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
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de Registro</label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="start">Início de Ronda</SelectItem>
                        <SelectItem value="end">Fim de Ronda</SelectItem>
                        <SelectItem value="maintenance">Manutenção</SelectItem>
                        <SelectItem value="fuel">Abastecimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vehicle Summary */}
            {selectedVehicleData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    {selectedVehicleData.license_plate}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-tactical-blue">
                        {selectedVehicleData.current_odometer.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">km Atual</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-tactical-green">
                        {records.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Registros</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-medium text-foreground">
                        {selectedVehicleData.brand} {selectedVehicleData.model}
                      </div>
                      <div className="text-sm text-muted-foreground">{selectedVehicleData.year}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-medium text-foreground">
                        {records.filter(r => r.record_type === 'fuel').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Abastecimentos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Records List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Histórico de Registros
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Carregando...</p>
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-8">
                    <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum registro encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {records.map((record) => (
                      <div key={record.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge className={`${getRecordTypeColor(record.record_type)} text-white`}>
                              {getRecordTypeLabel(record.record_type)}
                            </Badge>
                            <span className="font-medium text-lg">
                              {record.odometer_reading.toLocaleString()} km
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(record.recorded_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            Registrado por: {record.profiles?.name || 'N/A'}
                          </div>
                          
                          {record.photo_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(record.photo_url, '_blank')}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Ver Foto
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default VehicleHistory;