import { Shield, UserCheck, Users, FileText, MapPin, Car, AlertTriangle, Fuel, Wrench, FileBarChart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

const Documentation = () => {
  const rolePermissions = {
    admin: {
      icon: Shield,
      label: "Administrador",
      color: "bg-tactical-red",
      description: "Acesso total ao sistema com permissões de gerenciamento completo",
      permissions: [
        {
          icon: Users,
          title: "Gerenciamento de Usuários",
          description: "Criar, editar, ativar/desativar e excluir usuários do sistema",
          actions: ["Criar novos usuários", "Redefinir senhas", "Alterar funções", "Excluir usuários"]
        },
        {
          icon: MapPin,
          title: "Gerenciamento de Clientes",
          description: "Controle completo sobre clientes e checkpoints",
          actions: ["Criar e editar clientes", "Gerenciar checkpoints", "Definir coordenadas GPS", "Gerar QR Codes"]
        },
        {
          icon: FileText,
          title: "Gestão de Rondas",
          description: "Visualizar, criar, editar e excluir todas as rondas",
          actions: ["Ver todas as rondas", "Criar templates de rondas", "Atribuir táticos", "Excluir rondas"]
        },
        {
          icon: Car,
          title: "Gestão de Veículos",
          description: "Controle completo da frota",
          actions: ["Adicionar/remover veículos", "Gerenciar manutenções", "Controlar abastecimentos", "Ver histórico completo"]
        },
        {
          icon: AlertTriangle,
          title: "Gestão de Incidentes",
          description: "Monitorar e gerenciar todos os incidentes",
          actions: ["Ver todos os incidentes", "Alterar status", "Atribuir investigações", "Excluir incidentes"]
        },
        {
          icon: FileBarChart,
          title: "Relatórios e Auditoria",
          description: "Acesso completo a relatórios e logs de auditoria",
          actions: ["Gerar relatórios", "Ver logs de auditoria", "Exportar dados", "Análises avançadas"]
        }
      ]
    },
    operador: {
      icon: UserCheck,
      label: "Operador",
      color: "bg-tactical-blue",
      description: "Gerenciamento operacional e monitoramento em tempo real",
      permissions: [
        {
          icon: Users,
          title: "Visualização de Usuários",
          description: "Acesso de leitura aos usuários do sistema",
          actions: ["Ver lista de usuários", "Ver informações de táticos"]
        },
        {
          icon: MapPin,
          title: "Gerenciamento de Clientes",
          description: "Controle completo sobre clientes e checkpoints",
          actions: ["Criar e editar clientes", "Gerenciar checkpoints", "Definir coordenadas GPS", "Gerar QR Codes"]
        },
        {
          icon: FileText,
          title: "Gestão de Rondas",
          description: "Criar, atribuir e monitorar rondas",
          actions: ["Criar novas rondas", "Atribuir táticos", "Ver todas as rondas", "Monitorar progresso em tempo real"]
        },
        {
          icon: Car,
          title: "Visualização de Veículos",
          description: "Acesso completo às informações de veículos",
          actions: ["Ver frota", "Consultar histórico", "Monitorar manutenções", "Ver abastecimentos"]
        },
        {
          icon: AlertTriangle,
          title: "Gestão de Incidentes",
          description: "Monitorar e gerenciar incidentes",
          actions: ["Ver todos os incidentes", "Investigar incidentes", "Alterar status", "Resolver ocorrências"]
        },
        {
          icon: FileBarChart,
          title: "Relatórios",
          description: "Gerar e visualizar relatórios operacionais",
          actions: ["Gerar relatórios", "Exportar dados", "Análises operacionais"]
        }
      ]
    },
    tatico: {
      icon: Users,
      label: "Tático",
      color: "bg-tactical-green",
      description: "Execução de rondas e registro de atividades em campo",
      permissions: [
        {
          icon: FileText,
          title: "Minhas Rondas",
          description: "Visualizar e executar rondas atribuídas",
          actions: ["Ver rondas atribuídas", "Iniciar rondas", "Registrar checkpoints", "Finalizar rondas"]
        },
        {
          icon: MapPin,
          title: "Checkpoints",
          description: "Registrar visitas aos checkpoints",
          actions: ["Escanear QR Codes", "Registrar visitas", "Completar checklists", "Tirar fotos"]
        },
        {
          icon: AlertTriangle,
          title: "Registro de Incidentes",
          description: "Criar e reportar incidentes encontrados",
          actions: ["Criar incidentes", "Tirar fotos", "Registrar localização", "Definir prioridade"]
        },
        {
          icon: Car,
          title: "Controle de Veículo",
          description: "Registrar uso e manutenção do veículo",
          actions: ["Registrar odômetro", "Registrar abastecimentos", "Reportar necessidade de manutenção"]
        },
        {
          icon: FileBarChart,
          title: "Histórico Pessoal",
          description: "Consultar histórico de atividades",
          actions: ["Ver rondas anteriores", "Consultar incidentes", "Ver rotas percorridas"]
        }
      ]
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documentação do Sistema</h1>
            <p className="text-muted-foreground mt-2">
              Entenda as permissões e funcionalidades de cada tipo de usuário
            </p>
          </div>

          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="admin" className="gap-2">
                <Shield className="w-4 h-4" />
                Administrador
              </TabsTrigger>
              <TabsTrigger value="operador" className="gap-2">
                <UserCheck className="w-4 h-4" />
                Operador
              </TabsTrigger>
              <TabsTrigger value="tatico" className="gap-2">
                <Users className="w-4 h-4" />
                Tático
              </TabsTrigger>
            </TabsList>

            {Object.entries(rolePermissions).map(([role, data]) => (
              <TabsContent key={role} value={role} className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${data.color}`}>
                        <data.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">{data.label}</CardTitle>
                        <CardDescription className="text-base mt-1">
                          {data.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  {data.permissions.map((permission, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <permission.icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{permission.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {permission.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Ações permitidas:</p>
                          <ul className="space-y-1">
                            {permission.actions.map((action, actionIndex) => (
                              <li key={actionIndex} className="flex items-start gap-2">
                                <Badge variant="outline" className="mt-0.5">✓</Badge>
                                <span className="text-sm">{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-primary/50 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Resumo de Acesso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {data.permissions.length}
                        </p>
                        <p className="text-sm text-muted-foreground">Módulos</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {data.permissions.reduce((acc, p) => acc + p.actions.length, 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Permissões</p>
                      </div>
                      <div className="text-center">
                        <Badge className={data.color}>
                          {role === 'admin' ? 'Acesso Total' : role === 'operador' ? 'Acesso Operacional' : 'Acesso Campo'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Documentation;
