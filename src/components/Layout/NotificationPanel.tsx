import { useState, useEffect } from "react";
import { Bell, X, CheckCircle, AlertTriangle, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  type: "round_created" | "round_completed" | "incident_open" | "incident_resolved" | "emergency";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  priority: "low" | "medium" | "high" | "critical";
  link?: string;
  metadata?: any;
}

export const NotificationPanel = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      fetchNotifications();
      
      // Set up real-time listeners
      const roundsChannel = supabase
        .channel('rounds-notifications')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'rounds' 
        }, (payload) => {
          handleNewRound(payload.new);
        })
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'rounds',
          filter: 'status=eq.completed'
        }, (payload) => {
          handleCompletedRound(payload.new);
        })
        .subscribe();

      const incidentsChannel = supabase
        .channel('incidents-notifications')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'incidents' 
        }, (payload) => {
          handleNewIncident(payload.new);
        })
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'incidents',
          filter: 'status=eq.resolved'
        }, (payload) => {
          handleResolvedIncident(payload.new);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(roundsChannel);
        supabase.removeChannel(incidentsChannel);
      };
    }
  }, [profile]);

  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  const fetchNotifications = async () => {
    // Fetch recent rounds
    const { data: recentRounds } = await supabase
      .from('rounds')
      .select(`
        id,
        status,
        created_at,
        start_time,
        end_time,
        profiles:user_id (name),
        clients:client_id (name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch recent incidents
    const { data: recentIncidents } = await supabase
      .from('incidents')
      .select(`
        id,
        title,
        status,
        priority,
        reported_at,
        resolved_at,
        rounds:round_id (
          profiles:user_id (name),
          clients:client_id (name)
        )
      `)
      .order('reported_at', { ascending: false })
      .limit(10);

    const newNotifications: Notification[] = [];

    // Process rounds
    if (recentRounds && profile?.role !== 'tatico') {
      recentRounds.forEach((round: any) => {
        if (round.status === 'pending' || round.status === 'active') {
          newNotifications.push({
            id: `round-${round.id}`,
            type: 'round_created',
            title: 'Nova Ronda Criada',
            description: `Ronda para ${round.clients?.name} foi criada por ${round.profiles?.name || 'Sistema'}`,
            timestamp: round.created_at,
            read: false,
            priority: 'medium',
            link: `/rounds`,
            metadata: round
          });
        } else if (round.status === 'completed' && round.end_time) {
          newNotifications.push({
            id: `round-completed-${round.id}`,
            type: 'round_completed',
            title: 'Ronda Finalizada',
            description: `Ronda para ${round.clients?.name} foi concluída por ${round.profiles?.name}`,
            timestamp: round.end_time,
            read: false,
            priority: 'low',
            link: `/history`,
            metadata: round
          });
        }
      });
    }

    // Process incidents
    if (recentIncidents && (profile?.role === 'admin' || profile?.role === 'operador')) {
      recentIncidents.forEach((incident: any) => {
        if (incident.status === 'open') {
          newNotifications.push({
            id: `incident-${incident.id}`,
            type: 'incident_open',
            title: `Incidente: ${incident.title}`,
            description: `Prioridade ${incident.priority} - ${incident.rounds?.clients?.name || 'Local desconhecido'}`,
            timestamp: incident.reported_at,
            read: false,
            priority: incident.priority,
            link: `/incidents`,
            metadata: incident
          });
        } else if (incident.status === 'resolved' && incident.resolved_at) {
          newNotifications.push({
            id: `incident-resolved-${incident.id}`,
            type: 'incident_resolved',
            title: 'Incidente Resolvido',
            description: incident.title,
            timestamp: incident.resolved_at,
            read: false,
            priority: 'low',
            link: `/incidents`,
            metadata: incident
          });
        }
      });
    }

    // Sort by timestamp
    newNotifications.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    setNotifications(newNotifications);
  };

  const handleNewRound = (round: any) => {
    if (profile?.role !== 'tatico') {
      const notification: Notification = {
        id: `round-${round.id}`,
        type: 'round_created',
        title: 'Nova Ronda Criada',
        description: `Uma nova ronda foi criada`,
        timestamp: round.created_at,
        read: false,
        priority: 'medium',
        link: `/rounds`,
        metadata: round
      };
      setNotifications(prev => [notification, ...prev]);
    }
  };

  const handleCompletedRound = (round: any) => {
    if (profile?.role !== 'tatico') {
      const notification: Notification = {
        id: `round-completed-${round.id}`,
        type: 'round_completed',
        title: 'Ronda Finalizada',
        description: `Uma ronda foi concluída`,
        timestamp: round.end_time || new Date().toISOString(),
        read: false,
        priority: 'low',
        link: `/history`,
        metadata: round
      };
      setNotifications(prev => [notification, ...prev]);
    }
  };

  const handleNewIncident = (incident: any) => {
    if (profile?.role === 'admin' || profile?.role === 'operador') {
      const notification: Notification = {
        id: `incident-${incident.id}`,
        type: 'incident_open',
        title: `Novo Incidente: ${incident.title}`,
        description: `Prioridade ${incident.priority}`,
        timestamp: incident.reported_at,
        read: false,
        priority: incident.priority,
        link: `/incidents`,
        metadata: incident
      };
      setNotifications(prev => [notification, ...prev]);
    }
  };

  const handleResolvedIncident = (incident: any) => {
    if (profile?.role === 'admin' || profile?.role === 'operador') {
      const notification: Notification = {
        id: `incident-resolved-${incident.id}`,
        type: 'incident_resolved',
        title: 'Incidente Resolvido',
        description: incident.title,
        timestamp: incident.resolved_at || new Date().toISOString(),
        read: false,
        priority: 'low',
        link: `/incidents`,
        metadata: incident
      };
      setNotifications(prev => [notification, ...prev]);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'round_created':
        return <Clock className="w-5 h-5 text-tactical-blue" />;
      case 'round_completed':
        return <CheckCircle className="w-5 h-5 text-tactical-green" />;
      case 'incident_open':
        return <AlertTriangle className="w-5 h-5 text-tactical-red" />;
      case 'incident_resolved':
        return <CheckCircle className="w-5 h-5 text-tactical-green" />;
      case 'emergency':
        return <AlertTriangle className="w-5 h-5 text-tactical-red" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">Alta</Badge>;
      case 'medium':
        return <Badge className="bg-tactical-blue">Média</Badge>;
      case 'low':
        return <Badge variant="outline">Baixa</Badge>;
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-tactical-red rounded-full flex items-center justify-center text-xs text-white font-bold pulse-tactical">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Notificações</SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          <div className="space-y-2 pr-4">
            {notifications.length === 0 ? (
              <Card className="p-8 text-center">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhuma notificação</p>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`p-4 cursor-pointer transition-colors hover:bg-accent ${
                    !notification.read ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {getPriorityBadge(notification.priority)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.timestamp), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
