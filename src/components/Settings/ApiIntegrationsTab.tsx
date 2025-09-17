import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiIntegrations } from '@/hooks/useApiIntegrations';
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ApiIntegrationDocsDialog } from '@/components/Settings/ApiIntegrationDocs';

export const ApiIntegrationsTab = () => {
  const { integrations, loading, updateIntegration, testWhatsApp, testEmail, generateReport } = useApiIntegrations();
  const { toast } = useToast();
  const [testData, setTestData] = useState({
    whatsapp: { phone: '', message: 'Teste de integração WhatsApp' },
    email: { email: '', subject: 'Teste de integração', content: 'Este é um teste de envio de email.' },
    report: { type: 'daily', startDate: '', endDate: '', recipients: '' }
  });
  const [docsOpen, setDocsOpen] = useState(false);

  const getIntegration = (name: string) => {
    return integrations.find(i => i.integration_name === name);
  };

  const handleUpdateConfig = async (integrationName: string, config: any, enabled: boolean) => {
    await updateIntegration(integrationName, config, enabled);
  };

  const handleTestWhatsApp = async () => {
    if (!testData.whatsapp.phone || !testData.whatsapp.message) {
      toast({
        title: "Erro",
        description: "Preencha o telefone e a mensagem",
        variant: "destructive",
      });
      return;
    }
    
    await testWhatsApp(testData.whatsapp.phone, testData.whatsapp.message);
  };

  const handleTestEmail = async (provider: string) => {
    if (!testData.email.email || !testData.email.subject || !testData.email.content) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos do email",
        variant: "destructive",
      });
      return;
    }
    
    await testEmail(testData.email.email, testData.email.subject, testData.email.content, provider);
  };

  const handleGenerateReport = async () => {
    if (!testData.report.startDate || !testData.report.endDate) {
      toast({
        title: "Erro",
        description: "Preencha as datas do relatório",
        variant: "destructive",
      });
      return;
    }
    
    const recipients = testData.report.recipients ? testData.report.recipients.split(',').map(r => r.trim()) : undefined;
    await generateReport(testData.report.type, testData.report.startDate, testData.report.endDate, recipients);
  };

  if (loading) {
    return <div>Carregando configurações...</div>;
  }

  const whatsappConfig = getIntegration('whatsapp_business');
  const sendgridConfig = getIntegration('sendgrid');
  const mailchimpConfig = getIntegration('mailchimp');
  const mapsConfig = getIntegration('google_maps');
  const reportsConfig = getIntegration('automated_reports');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Integrações de API
            </span>
            <Button variant="outline" size="sm" onClick={() => setDocsOpen(true)}>
              Guia de Configuração
            </Button>
          </CardTitle>
          <CardDescription>
            Configure e teste as integrações com serviços externos para automatizar notificações e relatórios
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            {whatsappConfig?.enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-orange-500" />}
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            {sendgridConfig?.enabled || mailchimpConfig?.enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-orange-500" />}
            Email
          </TabsTrigger>
          <TabsTrigger value="maps" className="flex items-center gap-2">
            {mapsConfig?.enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-orange-500" />}
            Mapas
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            {reportsConfig?.enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-orange-500" />}
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="gps">GPS</TabsTrigger>
        </TabsList>

        {/* WhatsApp Business API */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                WhatsApp Business API
                <Badge variant={whatsappConfig?.enabled ? "default" : "secondary"}>
                  {whatsappConfig?.enabled ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Configure a integração com WhatsApp Business para envio automático de notificações de rondas e alertas de emergência
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="whatsapp-token">Access Token</Label>
                  <Input
                    id="whatsapp-token"
                    type="password"
                    placeholder="Token de acesso do WhatsApp Business"
                    defaultValue={whatsappConfig?.config?.api_key || ''}
                    onBlur={(e) => {
                      if (whatsappConfig) {
                        handleUpdateConfig('whatsapp_business', {
                          ...whatsappConfig.config,
                          api_key: e.target.value
                        }, whatsappConfig.enabled);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp-phone">Phone Number ID</Label>
                  <Input
                    id="whatsapp-phone"
                    placeholder="ID do número de telefone"
                    defaultValue={whatsappConfig?.config?.phone_number || ''}
                    onBlur={(e) => {
                      if (whatsappConfig) {
                        handleUpdateConfig('whatsapp_business', {
                          ...whatsappConfig.config,
                          phone_number: e.target.value
                        }, whatsappConfig.enabled);
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={whatsappConfig?.enabled || false}
                  onCheckedChange={(checked) => {
                    if (whatsappConfig) {
                      handleUpdateConfig('whatsapp_business', whatsappConfig.config, checked);
                    }
                  }}
                />
                <Label>Ativar integração WhatsApp</Label>
              </div>

              {/* Teste WhatsApp */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Teste de Integração</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="test-phone">Telefone (com código do país)</Label>
                    <Input
                      id="test-phone"
                      placeholder="5511999999999"
                      value={testData.whatsapp.phone}
                      onChange={(e) => setTestData(prev => ({
                        ...prev,
                        whatsapp: { ...prev.whatsapp, phone: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="test-message">Mensagem</Label>
                    <Input
                      id="test-message"
                      value={testData.whatsapp.message}
                      onChange={(e) => setTestData(prev => ({
                        ...prev,
                        whatsapp: { ...prev.whatsapp, message: e.target.value }
                      }))}
                    />
                  </div>
                </div>
                <Button onClick={handleTestWhatsApp} className="mt-3" size="sm">
                  Testar Envio
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Marketing */}
        <TabsContent value="email">
          <div className="space-y-4">
            {/* SendGrid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  SendGrid
                  <Badge variant={sendgridConfig?.enabled ? "default" : "secondary"}>
                    {sendgridConfig?.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Configure o SendGrid para envio de emails transacionais e relatórios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="sendgrid-key">API Key</Label>
                    <Input
                      id="sendgrid-key"
                      type="password"
                      placeholder="SG.xxxxxxxxxxxxx"
                      defaultValue={sendgridConfig?.config?.api_key || ''}
                      onBlur={(e) => {
                        if (sendgridConfig) {
                          handleUpdateConfig('sendgrid', {
                            ...sendgridConfig.config,
                            api_key: e.target.value
                          }, sendgridConfig.enabled);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sendgrid-email">From Email</Label>
                    <Input
                      id="sendgrid-email"
                      type="email"
                      placeholder="noreply@empresa.com"
                      defaultValue={sendgridConfig?.config?.from_email || ''}
                      onBlur={(e) => {
                        if (sendgridConfig) {
                          handleUpdateConfig('sendgrid', {
                            ...sendgridConfig.config,
                            from_email: e.target.value
                          }, sendgridConfig.enabled);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sendgrid-name">From Name</Label>
                    <Input
                      id="sendgrid-name"
                      placeholder="Sistema de Rondas"
                      defaultValue={sendgridConfig?.config?.from_name || ''}
                      onBlur={(e) => {
                        if (sendgridConfig) {
                          handleUpdateConfig('sendgrid', {
                            ...sendgridConfig.config,
                            from_name: e.target.value
                          }, sendgridConfig.enabled);
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={sendgridConfig?.enabled || false}
                    onCheckedChange={(checked) => {
                      if (sendgridConfig) {
                        handleUpdateConfig('sendgrid', sendgridConfig.config, checked);
                      }
                    }}
                  />
                  <Label>Ativar SendGrid</Label>
                </div>
              </CardContent>
            </Card>

            {/* Mailchimp */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Mailchimp
                  <Badge variant={mailchimpConfig?.enabled ? "default" : "secondary"}>
                    {mailchimpConfig?.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Configure o Mailchimp para campanhas de email marketing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="mailchimp-key">API Key</Label>
                    <Input
                      id="mailchimp-key"
                      type="password"
                      placeholder="xxxxxxxxxxxxx-us1"
                      defaultValue={mailchimpConfig?.config?.api_key || ''}
                      onBlur={(e) => {
                        if (mailchimpConfig) {
                          handleUpdateConfig('mailchimp', {
                            ...mailchimpConfig.config,
                            api_key: e.target.value
                          }, mailchimpConfig.enabled);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailchimp-server">Server Prefix</Label>
                    <Input
                      id="mailchimp-server"
                      placeholder="us1"
                      defaultValue={mailchimpConfig?.config?.server_prefix || ''}
                      onBlur={(e) => {
                        if (mailchimpConfig) {
                          handleUpdateConfig('mailchimp', {
                            ...mailchimpConfig.config,
                            server_prefix: e.target.value
                          }, mailchimpConfig.enabled);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailchimp-list">List ID</Label>
                    <Input
                      id="mailchimp-list"
                      placeholder="xxxxxxxxxx"
                      defaultValue={mailchimpConfig?.config?.list_id || ''}
                      onBlur={(e) => {
                        if (mailchimpConfig) {
                          handleUpdateConfig('mailchimp', {
                            ...mailchimpConfig.config,
                            list_id: e.target.value
                          }, mailchimpConfig.enabled);
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={mailchimpConfig?.enabled || false}
                    onCheckedChange={(checked) => {
                      if (mailchimpConfig) {
                        handleUpdateConfig('mailchimp', mailchimpConfig.config, checked);
                      }
                    }}
                  />
                  <Label>Ativar Mailchimp</Label>
                </div>
              </CardContent>
            </Card>

            {/* Teste de Email */}
            <Card>
              <CardHeader>
                <CardTitle>Teste de Email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="test-email">Email de destino</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="teste@email.com"
                      value={testData.email.email}
                      onChange={(e) => setTestData(prev => ({
                        ...prev,
                        email: { ...prev.email, email: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="test-subject">Assunto</Label>
                    <Input
                      id="test-subject"
                      value={testData.email.subject}
                      onChange={(e) => setTestData(prev => ({
                        ...prev,
                        email: { ...prev.email, subject: e.target.value }
                      }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="test-content">Conteúdo</Label>
                  <Textarea
                    id="test-content"
                    rows={3}
                    value={testData.email.content}
                    onChange={(e) => setTestData(prev => ({
                      ...prev,
                      email: { ...prev.email, content: e.target.value }
                    }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleTestEmail('sendgrid')} size="sm" disabled={!sendgridConfig?.enabled}>
                    Testar SendGrid
                  </Button>
                  <Button onClick={() => handleTestEmail('mailchimp')} size="sm" disabled={!mailchimpConfig?.enabled}>
                    Testar Mailchimp
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Google Maps */}
        <TabsContent value="maps">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Google Maps API
                <Badge variant={mapsConfig?.enabled ? "default" : "secondary"}>
                  {mapsConfig?.enabled ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Configure a API do Google Maps para mapas interativos e otimização de rotas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="maps-key">API Key</Label>
                <Input
                  id="maps-key"
                  type="password"
                  placeholder="AIzaSyXXXXXXXXXXXXXXXXXX"
                  defaultValue={mapsConfig?.config?.api_key || ''}
                  onBlur={(e) => {
                    if (mapsConfig) {
                      handleUpdateConfig('google_maps', {
                        ...mapsConfig.config,
                        api_key: e.target.value
                      }, mapsConfig.enabled);
                    }
                  }}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={mapsConfig?.enabled || false}
                  onCheckedChange={(checked) => {
                    if (mapsConfig) {
                      handleUpdateConfig('google_maps', mapsConfig.config, checked);
                    }
                  }}
                />
                <Label>Ativar Google Maps</Label>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Funcionalidades habilitadas:</strong>
                  <br />• Mapas interativos com localização dos pontos de controle
                  <br />• Otimização automática de rotas entre checkpoints
                  <br />• Geolocalização precisa durante as rondas
                  <br />• Cálculo de distâncias e tempos estimados
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios Automatizados */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Relatórios Automatizados
                <Badge variant={reportsConfig?.enabled ? "default" : "secondary"}>
                  {reportsConfig?.enabled ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Configure o envio automático de relatórios diários, semanais e mensais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="report-schedule">Frequência</Label>
                  <select
                    id="report-schedule"
                    className="w-full p-2 border rounded-md"
                    defaultValue={reportsConfig?.config?.schedule || 'daily'}
                    onChange={(e) => {
                      if (reportsConfig) {
                        handleUpdateConfig('automated_reports', {
                          ...reportsConfig.config,
                          schedule: e.target.value
                        }, reportsConfig.enabled);
                      }
                    }}
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="report-recipients">Destinatários (emails separados por vírgula)</Label>
                  <Textarea
                    id="report-recipients"
                    placeholder="admin@empresa.com, supervisor@empresa.com"
                    defaultValue={reportsConfig?.config?.recipients?.join(', ') || ''}
                    onBlur={(e) => {
                      if (reportsConfig) {
                        const recipients = e.target.value.split(',').map(r => r.trim()).filter(r => r);
                        handleUpdateConfig('automated_reports', {
                          ...reportsConfig.config,
                          recipients
                        }, reportsConfig.enabled);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={reportsConfig?.enabled || false}
                  onCheckedChange={(checked) => {
                    if (reportsConfig) {
                      handleUpdateConfig('automated_reports', reportsConfig.config, checked);
                    }
                  }}
                />
                <Label>Ativar relatórios automáticos</Label>
              </div>

              {/* Teste de Relatório */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Gerar Relatório de Teste</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="test-report-start">Data Início</Label>
                    <Input
                      id="test-report-start"
                      type="date"
                      value={testData.report.startDate}
                      onChange={(e) => setTestData(prev => ({
                        ...prev,
                        report: { ...prev.report, startDate: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="test-report-end">Data Fim</Label>
                    <Input
                      id="test-report-end"
                      type="date"
                      value={testData.report.endDate}
                      onChange={(e) => setTestData(prev => ({
                        ...prev,
                        report: { ...prev.report, endDate: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="test-report-recipients">Destinatários (opcional)</Label>
                    <Input
                      id="test-report-recipients"
                      placeholder="email1@test.com, email2@test.com"
                      value={testData.report.recipients}
                      onChange={(e) => setTestData(prev => ({
                        ...prev,
                        report: { ...prev.report, recipients: e.target.value }
                      }))}
                    />
                  </div>
                </div>
                <Button onClick={handleGenerateReport} className="mt-3" size="sm">
                  Gerar Relatório de Teste
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GPS Tracking */}
        <TabsContent value="gps">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                GPS Tracking
                <Badge variant="default">Ativo</Badge>
              </CardTitle>
              <CardDescription>
                Sistema de rastreamento GPS já integrado ao aplicativo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Funcionalidades ativas:</strong>
                  <br />• Rastreamento em tempo real durante as rondas
                  <br />• Registro automático de localização nos checkpoints
                  <br />• Histórico completo de trajetos percorridos
                  <br />• Alertas de desvio de rota (quando configurado)
                  <br />• Integração com mapas para visualização em tempo real
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ApiIntegrationDocsDialog open={docsOpen} onOpenChange={setDocsOpen} />
    </div>
  );
};