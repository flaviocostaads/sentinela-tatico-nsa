import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCost, formatDistance } from "@/utils/routeCalculations";
import { DollarSign, Fuel, TrendingUp, Truck } from "lucide-react";
import { CostCalculationResult } from "@/hooks/useCostCalculator";

interface ResultsDisplayProps {
  results: CostCalculationResult | null;
}

export const ResultsDisplay = ({ results }: ResultsDisplayProps) => {
  if (!results) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">📊 Resultados do Cálculo</h3>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Distância Diária */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distância Diária</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.daily_distance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">
              Mensal: {formatDistance(results.monthly_distance * 1000)}
            </p>
          </CardContent>
        </Card>

        {/* Custo Combustível */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Combustível/Dia</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(results.daily_fuel_cost)}</div>
            <p className="text-xs text-muted-foreground">
              Mensal: {formatCost(results.monthly_fuel_cost)}
            </p>
          </CardContent>
        </Card>

        {/* Custo Mão de Obra */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mão de Obra/Dia</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(results.daily_labor_cost)}</div>
            <p className="text-xs text-muted-foreground">
              Mensal: {formatCost(results.monthly_labor_cost)}
            </p>
          </CardContent>
        </Card>

        {/* Custo Total */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(results.total_monthly_cost)}</div>
            <p className="text-xs text-muted-foreground">
              Por km: {formatCost(results.cost_per_km)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Valor Sugerido - Destacado */}
      <Card className="border-primary bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            💡 Valor Sugerido de Cobrança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCost(results.suggested_price)}
            <span className="text-sm font-normal text-muted-foreground ml-2">/mês</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Custo total + margem de lucro
          </p>
        </CardContent>
      </Card>

      {/* Breakdown Detalhado */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Combustível (mensal):</span>
              <span className="font-medium">{formatCost(results.monthly_fuel_cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Mão de Obra (mensal):</span>
              <span className="font-medium">{formatCost(results.monthly_labor_cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Consumo total:</span>
              <span className="font-medium">{results.fuel_consumption_monthly.toFixed(1)} L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor hora calculado:</span>
              <span className="font-medium">{formatCost(results.hourly_rate_calculated)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total Mensal:</span>
              <span>{formatCost(results.total_monthly_cost)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
