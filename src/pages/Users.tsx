import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Shield, UserCheck, Search, Mail, Key, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Layout/Header";
import Sidebar from "@/components/Layout/Sidebar";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "operador" | "tatico";
  active: boolean;
  created_at: string;
  updated_at: string;
}

const Users = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "tatico" as "admin" | "operador" | "tatico",
    temporaryPassword: ""
  });
  
  const [editEmailData, setEditEmailData] = useState({
    userId: "",
    currentEmail: "",
    newEmail: "",
    alternativeEmail: ""
  });
  
  const [resetPasswordData, setResetPasswordData] = useState({
    userId: "",
    userName: "",
    email: "",
    newPassword: "",
    confirmPassword: ""
  });
  
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteAdminDialogOpen, setDeleteAdminDialogOpen] = useState(false);
  const [deleteAdminData, setDeleteAdminData] = useState({
    userId: "",
    userName: "",
    password1: "",
    password2: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Realtime: atualizar lista quando novos perfis forem criados
  useEffect(() => {
    const channel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterProfiles();
  }, [profiles, selectedTab, searchTerm]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("name");

      if (error) throw error;
      setProfiles(data || []);
      setFilteredProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get current user info for audit log
      const { data: currentUser } = await supabase.auth.getUser();
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", currentUser.user?.id)
        .single();

      // Criar usuário com signUp para garantir criação no auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.temporaryPassword || Math.random().toString(36).slice(-12), // senha temporária se não informada
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: formData.name,
              role: formData.role
            }
          }
      });

      if (authError) throw authError;

      // Log the user invitation
      await supabase.rpc('log_audit_event', {
        p_user_id: currentUser.user?.id,
        p_user_name: currentProfile?.name || 'Admin',
        p_action: 'INVITE',
        p_table_name: 'auth.users',
        p_new_values: { name: formData.name, email: formData.email, role: formData.role }
      });

      toast({
        title: "Sucesso",
        description: "Convite enviado! O usuário receberá um email para definir sua senha.",
      });

      setDialogOpen(false);
      setFormData({ name: "", email: "", role: "tatico", temporaryPassword: "" });
      fetchProfiles();
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar convite",
        variant: "destructive",
      });
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Link de redefinição de senha enviado por email!",
      });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar link de redefinição",
        variant: "destructive",
      });
    }
  };

  const resetPasswordManually = async (userId: string, newPassword: string) => {
    try {
      // Get current user info for audit log
      const { data: currentUser } = await supabase.auth.getUser();
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", currentUser.user?.id)
        .single();

      // Create edge function call to reset password
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          targetUserId: userId, 
          newPassword: newPassword,
          adminUserId: currentUser.user?.id,
          adminName: currentProfile?.name || 'Admin'
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso", 
        description: "Senha redefinida com sucesso!",
      });

      setResetPasswordDialogOpen(false);
      setResetPasswordData({
        userId: "",
        userName: "",
        email: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      toast({
        title: "Erro",
        description: "Erro ao redefinir senha. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const filterProfiles = () => {
    let filtered = [...profiles];

    // Filtrar por função
    if (selectedTab !== "all") {
      filtered = filtered.filter(profile => profile.role === selectedTab);
    }

    // Filtrar por busca
    if (searchTerm) {
      filtered = filtered.filter(profile => 
        profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getRoleLabel(profile.role).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProfiles(filtered);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ active: !currentStatus })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Usuário ${!currentStatus ? "ativado" : "desativado"} com sucesso!`,
      });

      fetchProfiles();
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do usuário",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, userName: string, userRole: string) => {
    // Check if deleting an admin - require double password confirmation
    if (userRole === "admin") {
      setDeleteAdminData({
        userId,
        userName,
        password1: "",
        password2: ""
      });
      setDeleteAdminDialogOpen(true);
      return;
    }

    // For non-admin users, use standard confirmation
    if (!confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o usuário ${userName}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    await executeDelete(userId, userName);
  };

  const executeDelete = async (userId: string, userName: string) => {
    try {
      // Get current user info for audit log
      const { data: currentUser } = await supabase.auth.getUser();
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", currentUser.user?.id)
        .single();

      // Call the delete function
      const { error } = await supabase.rpc('delete_user_permanently', {
        p_user_id: userId,
        p_admin_user_id: currentUser.user?.id,
        p_admin_name: currentProfile?.name || 'Admin'
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Usuário ${userName} foi excluído permanentemente do sistema!`,
      });

      fetchProfiles();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir usuário. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAdmin = async () => {
    // Validate passwords are entered
    if (!deleteAdminData.password1 || !deleteAdminData.password2) {
      toast({
        title: "Erro",
        description: "Por favor, digite a senha do administrador duas vezes.",
        variant: "destructive",
      });
      return;
    }

    // Validate passwords match
    if (deleteAdminData.password1 !== deleteAdminData.password2) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem. Por favor, digite a mesma senha duas vezes.",
        variant: "destructive",
      });
      return;
    }

    // Verify current user's password
    const { data: currentUser } = await supabase.auth.getUser();
    const { error } = await supabase.auth.signInWithPassword({
      email: currentUser.user?.email || "",
      password: deleteAdminData.password1
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Senha do administrador incorreta.",
        variant: "destructive",
      });
      return;
    }

    // Close dialog and execute delete
    setDeleteAdminDialogOpen(false);
    await executeDelete(deleteAdminData.userId, deleteAdminData.userName);
    setDeleteAdminData({ userId: "", userName: "", password1: "", password2: "" });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-4 h-4" />;
      case "operador":
        return <UserCheck className="w-4 h-4" />;
      default:
        return <UserCheck className="w-4 h-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "operador":
        return "Operador";
      case "tatico":
        return "Tático";
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-tactical-red text-white";
      case "operador":
        return "bg-tactical-blue text-white";
      case "tatico":
        return "bg-tactical-green text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTabCount = (role: string) => {
    if (role === "all") return profiles.length;
    return profiles.filter(profile => profile.role === role).length;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gerenciamento de Usuários</h1>
              <p className="text-muted-foreground">
                Gerencie táticos, operadores e administradores do sistema
              </p>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-tactical-green hover:bg-tactical-green/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                </DialogHeader>
                <form onSubmit={createUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Função</Label>
                    <Select value={formData.role} onValueChange={(value: "admin" | "operador" | "tatico") => setFormData({ ...formData, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tatico">Tático</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temporaryPassword">Senha Provisória</Label>
                    <Input
                      id="temporaryPassword"
                      type="text"
                      placeholder="Digite uma senha provisória (opcional)"
                      value={formData.temporaryPassword}
                      onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se não informada, o usuário receberá um link para criar sua própria senha
                    </p>
                  </div>
                  <Button type="submit" className="w-full bg-tactical-green hover:bg-tactical-green/90">
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar Convite por Email
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Dialog para redefinir senha */}
            <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Redefinir Senha - {resetPasswordData.userName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Escolha como redefinir a senha para {resetPasswordData.userName}:
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      onClick={() => sendPasswordResetEmail(resetPasswordData.email)}
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <Mail className="w-6 h-6" />
                      <span className="text-xs text-center">Enviar Link por Email</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResetPasswordDialogOpen(false);
                        setTimeout(() => setResetPasswordDialogOpen(true), 100);
                      }}
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <Key className="w-6 h-6" />
                      <span className="text-xs text-center">Definir Nova Senha</span>
                    </Button>
                  </div>
                  
                  <div className="border-t pt-4 space-y-4">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
                        toast({
                          title: "Erro",
                          description: "As senhas não coincidem",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (resetPasswordData.newPassword.length < 6) {
                        toast({
                          title: "Erro", 
                          description: "A senha deve ter pelo menos 6 caracteres",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      await resetPasswordManually(resetPasswordData.userId, resetPasswordData.newPassword);
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">Nova Senha</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={resetPasswordData.newPassword}
                          onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                          placeholder="Digite a nova senha"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={resetPasswordData.confirmPassword}
                          onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                          placeholder="Confirme a nova senha"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-tactical-green hover:bg-tactical-green/90"
                        disabled={!resetPasswordData.newPassword || !resetPasswordData.confirmPassword}
                      >
                        Redefinir Senha
                      </Button>
                    </form>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Dialog para alterar email do administrador */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alterar Email do Administrador</DialogTitle>
                </DialogHeader>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const { error } = await supabase
                      .from("profiles")
                      .update({ 
                        email: editEmailData.newEmail,
                        alternative_email: editEmailData.alternativeEmail
                      })
                      .eq("user_id", editEmailData.userId);

                    if (error) throw error;

                    toast({
                      title: "Sucesso",
                      description: "Email atualizado com sucesso!",
                    });

                    setEmailDialogOpen(false);
                    fetchProfiles();
                  } catch (error) {
                    console.error("Error updating email:", error);
                    toast({
                      title: "Erro",
                      description: "Erro ao atualizar email",
                      variant: "destructive",
                    });
                  }
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Atual</Label>
                    <Input value={editEmailData.currentEmail} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">Novo Email</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={editEmailData.newEmail}
                      onChange={(e) => setEditEmailData({ ...editEmailData, newEmail: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alternativeEmail">Email Alternativo (Recuperação)</Label>
                    <Input
                      id="alternativeEmail"
                      type="email"
                      value={editEmailData.alternativeEmail}
                      onChange={(e) => setEditEmailData({ ...editEmailData, alternativeEmail: e.target.value })}
                      placeholder="Email para recuperação de senha"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-tactical-green hover:bg-tactical-green/90">
                    Atualizar Email
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* AlertDialog para excluir administrador com dupla confirmação de senha */}
            <AlertDialog open={deleteAdminDialogOpen} onOpenChange={setDeleteAdminDialogOpen}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-tactical-red">
                    ⚠️ Confirmação de Exclusão de Administrador
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p className="font-semibold text-foreground">
                      Você está prestes a EXCLUIR PERMANENTEMENTE o administrador: <span className="text-tactical-red">{deleteAdminData.userName}</span>
                    </p>
                    <p className="text-sm">
                      Por segurança, digite sua senha de administrador <strong>DUAS VEZES</strong> para confirmar esta ação irreversível.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="password1">Digite sua senha de administrador (1ª vez)</Label>
                    <Input
                      id="password1"
                      type="password"
                      value={deleteAdminData.password1}
                      onChange={(e) => setDeleteAdminData({ ...deleteAdminData, password1: e.target.value })}
                      placeholder="Digite sua senha"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">Digite sua senha de administrador (2ª vez)</Label>
                    <Input
                      id="password2"
                      type="password"
                      value={deleteAdminData.password2}
                      onChange={(e) => setDeleteAdminData({ ...deleteAdminData, password2: e.target.value })}
                      placeholder="Digite sua senha novamente"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => {
                    setDeleteAdminData({ userId: "", userName: "", password1: "", password2: "" });
                  }}>
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAdmin}
                    className="bg-tactical-red hover:bg-tactical-red/90"
                  >
                    Excluir Permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Barra de pesquisa e toggle de visualização */}
          <Card className="tactical-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email ou função..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 p-0"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 w-8 p-0"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4 tactical-card">
              <TabsTrigger value="tatico" className="flex items-center space-x-2">
                <span>Táticos</span>
                <Badge variant="secondary" className="bg-tactical-green/20 text-tactical-green">
                  {getTabCount("tatico")}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="operador" className="flex items-center space-x-2">
                <span>Operadores</span>
                <Badge variant="secondary" className="bg-tactical-blue/20 text-tactical-blue">
                  {getTabCount("operador")}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center space-x-2">
                <span>Administradores</span>
                <Badge variant="secondary" className="bg-tactical-red/20 text-tactical-red">
                  {getTabCount("admin")}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center space-x-2">
                <span>Todos</span>
                <Badge variant="secondary">
                  {getTabCount("all")}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {["all", "tatico", "operador", "admin"].map((role) => (
              <TabsContent key={role} value={role} className="mt-6">
                <div className={viewMode === "grid" 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                  : "flex flex-col gap-3"}>
                  {filteredProfiles.map((profile) => (
                    <Card key={profile.id} className={`tactical-card ${viewMode === "list" ? "hover:shadow-lg transition-shadow" : ""}`}>
                      {viewMode === "grid" ? (
                        <>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-full ${getRoleColor(profile.role)}`}>
                                  {getRoleIcon(profile.role)}
                                </div>
                                <div>
                                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Badge className={getRoleColor(profile.role)}>
                                  {getRoleLabel(profile.role)}
                                </Badge>
                                <Badge variant={profile.active ? "default" : "secondary"}>
                                  {profile.active ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              
                              <div className="text-xs text-muted-foreground">
                                Criado em: {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                              </div>
                              
                              <div className="flex flex-col space-y-2">
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleUserStatus(profile.user_id, profile.active)}
                                    className={profile.active ? "hover:bg-tactical-red/10 hover:text-tactical-red" : "hover:bg-tactical-green/10 hover:text-tactical-green"}
                                  >
                                    {profile.active ? "Desativar" : "Ativar"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setResetPasswordData({
                                        userId: profile.user_id,
                                        userName: profile.name,
                                        email: profile.email,
                                        newPassword: "",
                                        confirmPassword: ""
                                      });
                                      setResetPasswordDialogOpen(true);
                                    }}
                                    className="hover:bg-tactical-blue/10 hover:text-tactical-blue"
                                  >
                                    <Key className="w-4 h-4 mr-1" />
                                    Redefinir Senha
                                  </Button>
                                </div>
                                <div className="flex space-x-2">
                                  {profile.role === "admin" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditEmailData({
                                          userId: profile.user_id,
                                          currentEmail: profile.email,
                                          newEmail: "",
                                          alternativeEmail: ""
                                        });
                                        setEmailDialogOpen(true);
                                      }}
                                      className="hover:bg-tactical-blue/10 hover:text-tactical-blue flex-1"
                                    >
                                      <Edit className="w-4 h-4 mr-1" />
                                      Alterar Email
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteUser(profile.user_id, profile.name, profile.role)}
                                    className={`bg-tactical-red hover:bg-tactical-red/90 ${profile.role === "admin" ? "flex-1" : "w-full"}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Excluir
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </>
                      ) : (
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`p-2 rounded-full ${getRoleColor(profile.role)}`}>
                                {getRoleIcon(profile.role)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{profile.name}</h3>
                                  <Badge className={getRoleColor(profile.role)} variant="outline">
                                    {getRoleLabel(profile.role)}
                                  </Badge>
                                  <Badge variant={profile.active ? "default" : "secondary"}>
                                    {profile.active ? "Ativo" : "Inativo"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{profile.email}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Criado em: {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleUserStatus(profile.user_id, profile.active)}
                                className={profile.active ? "hover:bg-tactical-red/10 hover:text-tactical-red" : "hover:bg-tactical-green/10 hover:text-tactical-green"}
                              >
                                {profile.active ? "Desativar" : "Ativar"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setResetPasswordData({
                                    userId: profile.user_id,
                                    userName: profile.name,
                                    email: profile.email,
                                    newPassword: "",
                                    confirmPassword: ""
                                  });
                                  setResetPasswordDialogOpen(true);
                                }}
                                className="hover:bg-tactical-blue/10 hover:text-tactical-blue"
                              >
                                <Key className="w-4 h-4 mr-1" />
                                Redefinir Senha
                              </Button>
                              {profile.role === "admin" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditEmailData({
                                      userId: profile.user_id,
                                      currentEmail: profile.email,
                                      newEmail: "",
                                      alternativeEmail: ""
                                    });
                                    setEmailDialogOpen(true);
                                  }}
                                  className="hover:bg-tactical-blue/10 hover:text-tactical-blue"
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Alterar Email
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteUser(profile.user_id, profile.name, profile.role)}
                                className="bg-tactical-red hover:bg-tactical-red/90"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {profiles.length === 0 && !loading && (
            <Card className="tactical-card">
              <CardContent className="text-center py-12">
                <UserCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhum usuário encontrado</h3>
                <p className="text-muted-foreground">
                  Os usuários aparecerão aqui após se cadastrarem no sistema.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default Users;