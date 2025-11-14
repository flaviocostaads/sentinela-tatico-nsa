import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from "lucide-react";

interface PerformanceChartProps {
  data: {
    hour: string;
    rounds: number;
    checkpoints: number;
    incidents: number;
  }[];
}

export const PerformanceChart = ({ data }: PerformanceChartProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <div>
            <CardTitle>Atividade nas Últimas 24 Horas</CardTitle>
            <CardDescription>Rondas, checkpoints e incidentes por hora</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="hour" 
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="rounds" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Rondas"
            />
            <Line 
              type="monotone" 
              dataKey="checkpoints" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              name="Checkpoints"
            />
            <Line 
              type="monotone" 
              dataKey="incidents" 
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              name="Incidentes"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
