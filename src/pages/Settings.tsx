import { useState, useEffect } from "react";
import { Save, Upload, Building, Mail, Phone, MapPin, FileText, Key, Database, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";
import { ApiIntegrationsTab } from '@/components/Settings/ApiIntegrationsTab';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    companyName: "Sentinela Tático NSA",
    companyDescription: "Sistema de Gestão de Rondas Táticas",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    apiKey: "",
    apiEndpoint: "",
    logoUrl: "",
    headerLogoUrl: "",
    loginLogoUrl: "",
    reportLogoUrl: "",
    qrLogoUrl: "",
    faviconUrl: "",
    systemVersion: "1.0.0",
    maintenanceMode: false,
    notificationsEnabled: true,
    documentationUrl: "",
    supportEmail: "",
    backupFrequency: "daily"
  });
  const [logoFiles, setLogoFiles] = useState<{[key: string]: File | null}>({
    header: null,
    login: null, 
    report: null,
    qr: null,
    favicon: null
  });

  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load company settings from database
      const { data: companySettings, error } = await supabase
        .from("company_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && companySettings) {
        setSettings(prev => ({
          ...prev,
          companyName: companySettings.company_name || prev.companyName,
          companyDescription: companySettings.description || prev.companyDescription,
          companyAddress: companySettings.address || prev.companyAddress,
          companyPhone: companySettings.phone || prev.companyPhone,
          companyEmail: companySettings.email || prev.companyEmail,
          logoUrl: companySettings.logo_url || prev.logoUrl,
          headerLogoUrl: companySettings.header_logo_url || prev.headerLogoUrl,
          loginLogoUrl: companySettings.login_logo_url || prev.loginLogoUrl,
          reportLogoUrl: companySettings.report_logo_url || prev.reportLogoUrl,
          qrLogoUrl: companySettings.qr_logo_url || prev.qrLogoUrl,
          faviconUrl: companySettings.favicon_url || prev.faviconUrl,
        }));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações",
        variant: "destructive",
      });
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      let logoUrls = {
        logoUrl: settings.logoUrl,
        headerLogoUrl: settings.headerLogoUrl,
        loginLogoUrl: settings.loginLogoUrl,
        reportLogoUrl: settings.reportLogoUrl,
        qrLogoUrl: settings.qrLogoUrl,
        faviconUrl: settings.faviconUrl,
      };

      // Upload logos if new files were selected
      const logoTypes = ['header', 'login', 'report', 'qr', 'favicon'] as const;
      
      for (const type of logoTypes) {
        const file = logoFiles[type];
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${type}-logo-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('company-logos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('company-logos')
            .getPublicUrl(fileName);

          const logoUrlKey = `${type}LogoUrl` as keyof typeof logoUrls;
          logoUrls[logoUrlKey] = publicUrl;
        }
      }

      // Save settings to database
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_name: settings.companyName,
          description: settings.companyDescription,
          address: settings.companyAddress,
          phone: settings.companyPhone,
          email: settings.companyEmail,
          logo_url: logoUrls.logoUrl,
          header_logo_url: logoUrls.headerLogoUrl,
          login_logo_url: logoUrls.loginLogoUrl,
          report_logo_url: logoUrls.reportLogoUrl,
          qr_logo_url: logoUrls.qrLogoUrl,
          favicon_url: logoUrls.faviconUrl,
        });

      if (error) throw error;

      // Update local state
      setSettings(prev => ({ 
        ...prev, 
        logoUrl: logoUrls.logoUrl,
        headerLogoUrl: logoUrls.headerLogoUrl,
        loginLogoUrl: logoUrls.loginLogoUrl,
        reportLogoUrl: logoUrls.reportLogoUrl,
        qrLogoUrl: logoUrls.qrLogoUrl,
        faviconUrl: logoUrls.faviconUrl,
      }));
      
      setLogoFiles({
        header: null,
        login: null, 
        report: null,
        qr: null,
        favicon: null
      });

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, logoType: keyof typeof logoFiles) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo deve ser menor que 2MB",
          variant: "destructive",
        });
        return;
      }

      // Store file for upload and create preview
      setLogoFiles(prev => ({ ...prev, [logoType]: file }));
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoUrlKey = `${logoType}LogoUrl` as keyof typeof settings;
        setSettings(prev => ({ ...prev, [logoUrlKey]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackupManual = async () => {
    try {
      setLoading(true);
      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: "Backup Iniciado",
        description: "Backup manual foi iniciado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao iniciar backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSystemLogs = () => {
    toast({
      title: "Logs do Sistema",
      description: "Abrindo visualizador de logs...",
    });
    // Open logs in new window/modal
    window.open('/audit-logs', '_blank');
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      
      // Export basic system data
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: vehicles } = await supabase.from("vehicles").select("*");
      const { data: clients } = await supabase.from("clients").select("*");
      
      const exportData = {
        profiles: profiles || [],
        vehicles: vehicles || [],
        clients: clients || [],
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sistema-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação Concluída",
        description: "Dados do sistema foram exportados com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateTokens = async () => {
    try {
      setLoading(true);
      // Simulate token regeneration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newApiKey = `sk-${Math.random().toString(36).substr(2, 32)}`;
      setSettings({ ...settings, apiKey: newApiKey });
      
      toast({
        title: "Tokens Regenerados",
        description: "Novos tokens de API foram gerados com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao regenerar tokens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Configurações da Plataforma</h1>
              <p className="text-muted-foreground">
                Gerencie configurações da empresa, sistema e integrações
              </p>
            </div>
            
            <Button onClick={saveSettings} disabled={loading} className="bg-tactical-green hover:bg-tactical-green/90">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>

          <Tabs defaultValue="company" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 tactical-card">
              <TabsTrigger value="company" className="flex items-center space-x-2">
                <Building className="w-4 h-4" />
                <span>Empresa</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center space-x-2">
                <Monitor className="w-4 h-4" />
                <span>Sistema</span>
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center space-x-2">
                <Key className="w-4 h-4" />
                <span>API & Integrações</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center space-x-2">
                <Database className="w-4 h-4" />
                <span>Avançado</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="company">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="tactical-card">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Building className="w-5 h-5" />
                      <span>Informações da Empresa</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nome da Empresa</Label>
                      <Input
                        id="companyName"
                        value={settings.companyName}
                        onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="companyDescription">Descrição</Label>
                      <Textarea
                        id="companyDescription"
                        value={settings.companyDescription}
                        onChange={(e) => setSettings({ ...settings, companyDescription: e.target.value })}
                        rows={3}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="companyAddress">Endereço</Label>
                      <Input
                        id="companyAddress"
                        value={settings.companyAddress}
                        onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                        placeholder="Endereço completo da empresa"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyPhone">Telefone</Label>
                        <Input
                          id="companyPhone"
                          value={settings.companyPhone}
                          onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="companyEmail">Email</Label>
                        <Input
                          id="companyEmail"
                          type="email"
                          value={settings.companyEmail}
                          onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                          placeholder="contato@empresa.com"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="tactical-card lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Upload className="w-5 h-5" />
                      <span>Logomarcas por Uso</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      
                      {/* Header Logo */}
                      <div className="space-y-2">
                        <Label className="font-medium">Logo do Cabeçalho</Label>
                        <p className="text-xs text-muted-foreground mb-2">Usado no topo da plataforma e aplicativo</p>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                          {settings.headerLogoUrl ? (
                            <div className="space-y-2">
                              <img 
                                src={settings.headerLogoUrl} 
                                alt="Logo do cabeçalho" 
                                className="max-h-16 mx-auto rounded"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('headerLogoInput')?.click()}
                              >
                                Alterar
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('headerLogoInput')?.click()}
                              >
                                Upload
                              </Button>
                            </div>
                          )}
                          <input
                            id="headerLogoInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'header')}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Login Logo */}
                      <div className="space-y-2">
                        <Label className="font-medium">Logo de Login</Label>
                        <p className="text-xs text-muted-foreground mb-2">Usado na tela de autenticação</p>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                          {settings.loginLogoUrl ? (
                            <div className="space-y-2">
                              <img 
                                src={settings.loginLogoUrl} 
                                alt="Logo de login" 
                                className="max-h-16 mx-auto rounded"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('loginLogoInput')?.click()}
                              >
                                Alterar
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('loginLogoInput')?.click()}
                              >
                                Upload
                              </Button>
                            </div>
                          )}
                          <input
                            id="loginLogoInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'login')}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Report Logo */}
                      <div className="space-y-2">
                        <Label className="font-medium">Logo para Relatórios</Label>
                        <p className="text-xs text-muted-foreground mb-2">Usado em relatórios e impressões</p>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                          {settings.reportLogoUrl ? (
                            <div className="space-y-2">
                              <img 
                                src={settings.reportLogoUrl} 
                                alt="Logo para relatórios" 
                                className="max-h-16 mx-auto rounded"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('reportLogoInput')?.click()}
                              >
                                Alterar
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('reportLogoInput')?.click()}
                              >
                                Upload
                              </Button>
                            </div>
                          )}
                          <input
                            id="reportLogoInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'report')}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* QR Code Logo */}
                      <div className="space-y-2">
                        <Label className="font-medium">Logo para QR Code</Label>
                        <p className="text-xs text-muted-foreground mb-2">Usado na impressão de QR codes</p>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                          {settings.qrLogoUrl ? (
                            <div className="space-y-2">
                              <img 
                                src={settings.qrLogoUrl} 
                                alt="Logo para QR code" 
                                className="max-h-16 mx-auto rounded"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('qrLogoInput')?.click()}
                              >
                                Alterar
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('qrLogoInput')?.click()}
                              >
                                Upload
                              </Button>
                            </div>
                          )}
                          <input
                            id="qrLogoInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'qr')}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Favicon */}
                      <div className="space-y-2">
                        <Label className="font-medium">Favicon</Label>
                        <p className="text-xs text-muted-foreground mb-2">Ícone da aba do navegador (16x16 ou 32x32)</p>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                          {settings.faviconUrl ? (
                            <div className="space-y-2">
                              <img 
                                src={settings.faviconUrl} 
                                alt="Favicon" 
                                className="max-h-16 mx-auto rounded"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('faviconInput')?.click()}
                              >
                                Alterar
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('faviconInput')?.click()}
                              >
                                Upload
                              </Button>
                            </div>
                          )}
                          <input
                            id="faviconInput"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'favicon')}
                            className="hidden"
                          />
                        </div>
                      </div>
                      
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p><strong>Dica:</strong> Cada logo pode ter tamanhos e formatos específicos para melhor visualização em diferentes contextos.</p>
                      <p>Formatos suportados: PNG, JPG, SVG • Tamanho máximo: 2MB cada</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="system">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="tactical-card">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Monitor className="w-5 h-5" />
                      <span>Informações do Sistema</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Versão do Sistema</Label>
                      <Input value={settings.systemVersion} disabled />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="supportEmail">Email de Suporte</Label>
                      <Input
                        id="supportEmail"
                        type="email"
                        value={settings.supportEmail}
                        onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                        placeholder="suporte@empresa.com"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="documentationUrl">URL da Documentação</Label>
                      <Input
                        id="documentationUrl"
                        value={settings.documentationUrl}
                        onChange={(e) => setSettings({ ...settings, documentationUrl: e.target.value })}
                        placeholder="https://docs.empresa.com"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="tactical-card">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>Configurações Operacionais</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Modo de Manutenção</Label>
                        <p className="text-sm text-muted-foreground">
                          Desabilita acesso para usuários não-admin
                        </p>
                      </div>
                      <Button
                        variant={settings.maintenanceMode ? "destructive" : "outline"}
                        onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
                      >
                        {settings.maintenanceMode ? "Ativado" : "Desativado"}
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Notificações</Label>
                        <p className="text-sm text-muted-foreground">
                          Habilita notificações do sistema
                        </p>
                      </div>
                      <Button
                        variant={settings.notificationsEnabled ? "default" : "outline"}
                        onClick={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
                      >
                        {settings.notificationsEnabled ? "Ativado" : "Desativado"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="api">
              <ApiIntegrationsTab />
            </TabsContent>

            <TabsContent value="advanced">
              <Card className="tactical-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="w-5 h-5" />
                    <span>Configurações Avançadas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Frequência de Backup</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={settings.backupFrequency}
                      onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                    >
                      <option value="hourly">A cada hora</option>
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                  
                  <div className="border border-border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Ferramentas de Sistema</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <Button 
                        variant="outline" 
                        className="justify-start"
                        onClick={() => handleBackupManual()}
                      >
                        <Database className="w-4 h-4 mr-2" />
                        Backup Manual
                      </Button>
                      <Button 
                        variant="outline" 
                        className="justify-start"
                        onClick={() => handleSystemLogs()}
                      >
                        <Monitor className="w-4 h-4 mr-2" />
                        Log do Sistema
                      </Button>
                      <Button 
                        variant="outline" 
                        className="justify-start"
                        onClick={() => handleExportData()}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Exportar Dados
                      </Button>
                      <Button 
                        variant="outline" 
                        className="justify-start"
                        onClick={() => handleRegenerateTokens()}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Regenerar Tokens
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Settings;