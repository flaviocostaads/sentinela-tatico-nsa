import { 
  LayoutDashboard, 
  MapPin, 
  Users, 
  FileText, 
  Shield, 
  Settings, 
  AlertTriangle,
  Radio,
  Navigation,
  Clock,
  Building2,
  Fuel,
  Wrench,
  BookOpen,
  Layers,
  ClipboardCheck,
  Settings as SettingsIcon,
  Calculator
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatusWidget from "@/components/Dashboard/StatusWidget";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  className?: string;
}

interface MenuNotifications {
  activeRounds: number;
  openIncidents: number;
}

const getBaseMenuItems = (notifications: MenuNotifications) => [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", notifications: 0 },
  { icon: Building2, label: "Clientes", path: "/clients", notifications: 0 },
  { icon: Users, label: "Usuários", path: "/users", notifications: 0 },
  { icon: Navigation, label: "Veículos", path: "/vehicles", notifications: 0 },
  { icon: MapPin, label: "Mapa de Rondas", path: "/map", notifications: 0 },
  { icon: Radio, label: "Rondas Ativas", path: "/rounds", notifications: notifications.activeRounds },
  { icon: Layers, label: "Templates de Ronda", path: "/round-templates", notifications: 0 },
  { icon: Clock, label: "Histórico", path: "/history", notifications: 0 },
  { icon: FileText, label: "Relatórios", path: "/reports", notifications: 0 },
  { icon: Calculator, label: "Calculadora de Custos", path: "/cost-calculator", notifications: 0 },
  { icon: AlertTriangle, label: "Ocorrências", path: "/incidents", notifications: notifications.openIncidents },
  { icon: Fuel, label: "Abastecimento", path: "/fuel-management", notifications: 0 },
  { icon: SettingsIcon, label: "Config. Combustível", path: "/fuel-configuration", notifications: 0 },
  { icon: Wrench, label: "Manutenção", path: "/maintenance-management", notifications: 0 },
  { icon: ClipboardCheck, label: "Inspeções Veiculares", path: "/vehicle-inspections", notifications: 0 },
  { icon: ClipboardCheck, label: "Templates de Inspeção", path: "/vehicle-inspection-templates", notifications: 0 },
  { icon: BookOpen, label: "Documentação", path: "/documentation", notifications: 0 },
  { icon: Shield, label: "Logs de Auditoria", path: "/audit-logs", notifications: 0 }
];

const Sidebar = ({ className }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<MenuNotifications>({
    activeRounds: 0,
    openIncidents: 0
  });

  useEffect(() => {
    fetchNotifications();
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      // Buscar rondas ativas
      const { data: activeRounds } = await supabase
        .from("rounds")
        .select("id")
        .eq("status", "active");

      // Buscar incidentes abertos
      const { data: openIncidents } = await supabase
        .from("incidents")
        .select("id")
        .eq("status", "open");

      setNotifications({
        activeRounds: activeRounds?.length || 0,
        openIncidents: openIncidents?.length || 0
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const getFilteredMenuItems = () => {
    const baseItems = getBaseMenuItems(notifications);
    
    if (profile?.role === 'tatico') {
      return [
        baseItems[0], // Dashboard
        baseItems[5], // Rondas Ativas
        baseItems[8], // Ocorrências
      ];
    }
    
    return baseItems;
  };

  const menuItems = getFilteredMenuItems();

  return (
    <aside className={cn("w-64 bg-card border-r border-border", className)}>
      <div className="p-6">
        {/* Status Geral */}
        <StatusWidget />

        {/* Menu Navigation */}
        <nav className="space-y-1">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-tactical",
                  isActive 
                    ? "bg-tactical-blue text-white border border-tactical-blue/50 tactical-glow shadow-tactical font-medium" 
                    : "text-foreground hover:text-primary hover:bg-primary/20 dark:hover:bg-primary/30 dark:hover:text-primary"
                )}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.notifications > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-tactical-red rounded-full text-white font-medium">
                    {item.notifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;