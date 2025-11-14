import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

interface CriticalAlert {
  type: 'critical' | 'warning' | 'success';
  message: string;
}

interface CriticalAlertsCardProps {
  alerts: CriticalAlert[];
}

export const CriticalAlertsCard = ({ alerts }: CriticalAlertsCardProps) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <div>
            <CardTitle>Alertas e Atenção Imediata</CardTitle>
            <CardDescription>Situações que requerem monitoramento</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <Alert>
            <CheckCircle className="w-4 h-4 text-green-500" />
            <AlertDescription>Sistema operando normalmente</AlertDescription>
          </Alert>
        ) : (
          alerts.map((alert, index) => (
            <Alert key={index} variant={getAlertVariant(alert.type)}>
              {getAlertIcon(alert.type)}
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))
        )}
      </CardContent>
    </Card>
  );
};
