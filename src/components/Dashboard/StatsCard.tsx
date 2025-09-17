import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive: boolean;
  };
  status?: "success" | "warning" | "danger" | "info";
  className?: string;
}

const StatsCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  status = "info",
  className 
}: StatsCardProps) => {
  const statusColors = {
    success: "border-tactical-green bg-tactical-green/5",
    warning: "border-tactical-amber bg-tactical-amber/5", 
    danger: "border-tactical-red bg-tactical-red/5",
    info: "border-primary bg-primary/5"
  };

  const iconColors = {
    success: "text-tactical-green",
    warning: "text-tactical-amber",
    danger: "text-tactical-red", 
    info: "text-primary"
  };

  return (
    <div className={cn(
      "p-6 rounded-lg border tactical-card transition-tactical hover:shadow-glow",
      statusColors[status],
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {trend && (
            <div className="flex items-center space-x-1">
              <span className={cn(
                "text-xs font-medium",
                trend.positive ? "text-tactical-green" : "text-tactical-red"
              )}>
                {trend.positive ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-lg bg-background/50 border",
          iconColors[status]
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;