import { useState, useEffect } from "react";
import { Calendar, Clock, Search, User, Shield, Database, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const logsPerPage = 20;
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, actionFilter, tableFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, tableFilter]);

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar logs de auditoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Filtrar por busca
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.table_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por ação
    if (actionFilter !== "all") {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Filtrar por tabela
    if (tableFilter !== "all") {
      filtered = filtered.filter(log => log.table_name === tableFilter);
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Database className="w-4 h-4 text-tactical-green" />;
      case "UPDATE":
        return <Database className="w-4 h-4 text-tactical-blue" />;
      case "DELETE":
        return <Database className="w-4 h-4 text-tactical-red" />;
      default:
        return <Database className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-tactical-green/20 text-tactical-green";
      case "UPDATE":
        return "bg-tactical-blue/20 text-tactical-blue";
      case "DELETE":
        return "bg-tactical-red/20 text-tactical-red";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTableLabel = (tableName: string) => {
    const tableLabels: { [key: string]: string } = {
      profiles: "Usuários",
      rounds: "Rondas",
      vehicles: "Veículos",
      clients: "Clientes",
      incidents: "Ocorrências",
      checkpoints: "Pontos de Verificação"
    };
    return tableLabels[tableName] || tableName;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setActionFilter("all");
    setTableFilter("all");
  };

  const uniqueTables = [...new Set(logs.map(log => log.table_name))];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Logs de Auditoria</h1>
              <p className="text-muted-foreground">
                Registro de todas as operações do sistema
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-tactical-red" />
              <span className="text-sm text-muted-foreground">Apenas Administradores</span>
            </div>
          </div>

          {/* Filtros */}
          <Card className="tactical-card">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por usuário, ação ou tabela..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Ações</SelectItem>
                    <SelectItem value="CREATE">Criar</SelectItem>
                    <SelectItem value="UPDATE">Atualizar</SelectItem>
                    <SelectItem value="DELETE">Excluir</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tableFilter} onValueChange={setTableFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Tabela" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Tabelas</SelectItem>
                    {uniqueTables.map(table => (
                      <SelectItem key={table} value={table}>
                        {getTableLabel(table)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="whitespace-nowrap"
                >
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Logs */}
          <div className="space-y-3">
            {loading ? (
              <Card className="tactical-card">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Carregando logs...</p>
                </CardContent>
              </Card>
            ) : filteredLogs.length === 0 ? (
              <Card className="tactical-card">
                <CardContent className="text-center py-12">
                  <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Nenhum log encontrado</h3>
                  <p className="text-muted-foreground">
                    {logs.length === 0 
                      ? "Ainda não há registros de auditoria no sistema."
                      : "Nenhum log corresponde aos filtros aplicados."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              (() => {
                const startIndex = (currentPage - 1) * logsPerPage;
                const endIndex = startIndex + logsPerPage;
                const currentLogs = filteredLogs.slice(startIndex, endIndex);
                const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

                return (
                  <>
                    {currentLogs.map((log) => (
                <Card key={log.id} className="tactical-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 rounded-full bg-muted">
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{log.user_name}</span>
                            <Badge className={getActionColor(log.action)}>
                              {log.action}
                            </Badge>
                            <Badge variant="outline">
                              {getTableLabel(log.table_name)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(log.created_at).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                            </div>
                          </div>
                          {log.old_values && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              <span className="font-medium">Dados alterados:</span>
                              <pre className="mt-1 text-xs overflow-hidden">
                                {JSON.stringify(log.old_values, null, 2).substring(0, 200)}
                                {JSON.stringify(log.old_values, null, 2).length > 200 && "..."}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                    ))}
                    
                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6">
                        <div className="text-sm text-muted-foreground">
                          Mostrando {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} de {filteredLogs.length} logs
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            Anterior
                          </Button>
                          <span className="text-sm">
                            Página {currentPage} de {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuditLogs;