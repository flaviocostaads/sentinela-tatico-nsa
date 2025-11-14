import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Wrench, Fuel, TrendingUp } from "lucide-react";

interface FleetAnalysisCardProps {
  activeVehicles: number;
  inMaintenance: number;
  inactiveVehicles: number;
  pendingInspections: number;
  fuelingsToday: number;
  monthlyKm: number;
}

export const FleetAnalysisCard = ({
  activeVehicles,
  inMaintenance,
  inactiveVehicles,
  pendingInspections,
  fuelingsToday,
  monthlyKm,
}: FleetAnalysisCardProps) => {
  const metrics = [
    {
      label: "Veículos Ativos",
      value: activeVehicles,
      icon: Car,
      color: "text-green-500",
    },
    {
      label: "Em Manutenção",
      value: inMaintenance,
      icon: Wrench,
      color: "text-yellow-500",
    },
    {
      label: "Inativos",
      value: inactiveVehicles,
      icon: Car,
      color: "text-muted-foreground",
    },
    {
      label: "Inspeções Pendentes",
      value: pendingInspections,
      icon: Car,
      color: "text-destructive",
    },
    {
      label: "Abastecimentos Hoje",
      value: fuelingsToday,
      icon: Fuel,
      color: "text-primary",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          <div>
            <CardTitle>Frota e Manutenção</CardTitle>
            <CardDescription>Status geral dos veículos</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${metric.color}`} />
                <div>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="pt-4 border-t">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <div>
              <p className="text-2xl font-bold">{monthlyKm.toLocaleString()} km</p>
              <p className="text-xs text-muted-foreground">KM Rodados (Mês)</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
