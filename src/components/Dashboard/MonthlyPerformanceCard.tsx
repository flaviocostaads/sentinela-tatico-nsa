import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target } from "lucide-react";

interface MonthlyMetric {
  label: string;
  current: number;
  target: number;
  unit: string;
}

interface MonthlyPerformanceCardProps {
  metrics: MonthlyMetric[];
}

export const MonthlyPerformanceCard = ({ metrics }: MonthlyPerformanceCardProps) => {
  const getPercentage = (current: number, target: number) => {
    return Math.round((current / target) * 100);
  };

  const isGoalMet = (current: number, target: number) => {
    return current >= target;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <CardTitle>Performance do Mês</CardTitle>
            <CardDescription>Progresso em relação às metas estabelecidas</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {metrics.map((metric, index) => {
          const percentage = getPercentage(metric.current, metric.target);
          const goalMet = isGoalMet(metric.current, metric.target);
          
          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{metric.label}</span>
                  {goalMet && (
                    <Badge variant="default" className="bg-green-500">
                      Meta atingida
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {metric.current.toLocaleString()} / {metric.target.toLocaleString()} {metric.unit}
                </span>
              </div>
              <Progress value={percentage} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{percentage}% atingido</span>
                {!goalMet && (
                  <span className="text-primary">
                    Faltam {(metric.target - metric.current).toLocaleString()} {metric.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
