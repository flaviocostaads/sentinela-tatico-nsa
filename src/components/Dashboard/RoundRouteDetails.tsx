import { MapPin, Clock, Route as RouteIcon, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RouteDetailsProps {
  templateId: string;
  templateName: string;
  templateDescription?: string;
  clients: Array<{
    id: string;
    name: string;
    address: string;
    checkpoints_count: number;
  }>;
}

const RoundRouteDetails = ({ templateId, templateName, templateDescription, clients }: RouteDetailsProps) => {
  // Estimativa: 15 minutos por checkpoint + 10 minutos de deslocamento entre clientes
  const totalCheckpoints = clients.reduce((sum, client) => sum + client.checkpoints_count, 0);
  const estimatedMinutes = (totalCheckpoints * 15) + (clients.length * 10);
  const estimatedHours = Math.floor(estimatedMinutes / 60);
  const remainingMinutes = estimatedMinutes % 60;

  // Estimativa de distância: 5km por cliente
  const estimatedDistance = clients.length * 5;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2">{templateName}</h3>
        {templateDescription && (
          <p className="text-muted-foreground">{templateDescription}</p>
        )}
      </div>

      {/* Estatísticas do Trajeto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-tactical-blue" />
              <span className="text-sm text-muted-foreground">Total de Empresas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{clients.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-tactical-green" />
              <span className="text-sm text-muted-foreground">Total de Checkpoints</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalCheckpoints}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-tactical-amber" />
              <span className="text-sm text-muted-foreground">Tempo Estimado</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {estimatedHours}h {remainingMinutes}m
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estimativa de Distância */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RouteIcon className="w-5 h-5 text-tactical-blue" />
              <span className="text-sm text-muted-foreground">Distância Estimada</span>
            </div>
            <p className="text-xl font-bold text-foreground">~{estimatedDistance} km</p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Empresas no Trajeto */}
      <div>
        <h4 className="text-lg font-semibold text-foreground mb-3">Empresas no Trajeto</h4>
        <div className="space-y-3">
          {clients.map((client, index) => (
            <Card key={client.id} className="tactical-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Badge variant="outline" className="mt-1">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="font-semibold text-foreground">{client.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {client.address}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-tactical-blue text-white">
                    {client.checkpoints_count} {client.checkpoints_count === 1 ? 'checkpoint' : 'checkpoints'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Informações Adicionais */}
      <Card className="bg-muted">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Nota:</strong> Os valores de tempo e distância são estimativas baseadas em médias. 
            Os valores reais podem variar de acordo com o trânsito, condições da via e tempo de execução em cada checkpoint.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoundRouteDetails;
