import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle, Star } from "lucide-react";

interface ClientOverviewCardProps {
  totalClients: number;
  clientsWithRoundsToday: number;
  clientsWithoutIncidents: number;
  averageSatisfaction: number;
}

export const ClientOverviewCard = ({
  totalClients,
  clientsWithRoundsToday,
  clientsWithoutIncidents,
  averageSatisfaction,
}: ClientOverviewCardProps) => {
  const metrics = [
    {
      label: "Total de Clientes Ativos",
      value: totalClients,
      icon: Building2,
      color: "text-primary",
    },
    {
      label: "Clientes com Rondas Hoje",
      value: `${clientsWithRoundsToday} (${Math.round((clientsWithRoundsToday / totalClients) * 100)}%)`,
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      label: "Sem Incidentes (30 dias)",
      value: `${clientsWithoutIncidents} (${Math.round((clientsWithoutIncidents / totalClients) * 100)}%)`,
      icon: CheckCircle,
      color: "text-green-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <div>
            <CardTitle>Clientes - Overview</CardTitle>
            <CardDescription>Resumo geral dos clientes ativos</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="flex items-center gap-3">
              <Icon className={`w-4 h-4 ${metric.color}`} />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="text-lg font-semibold">{metric.value}</p>
              </div>
            </div>
          );
        })}
        
        <div className="pt-4 border-t">
          <div className="flex items-center gap-3">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Satisfação Média</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{averageSatisfaction.toFixed(1)}/5.0</p>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < Math.floor(averageSatisfaction)
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
