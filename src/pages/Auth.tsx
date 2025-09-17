import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [isUpdatePassword, setIsUpdatePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    role: "tatico" as "admin" | "operador" | "tatico"
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load company logo
  useEffect(() => {
    loadCompanyLogo();
  }, []);

  // Verificar se é uma redefinição de senha ao carregar
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'recovery') {
      setIsUpdatePassword(true);
      setIsLogin(false);
      setIsResetPassword(false);
    }
  }, []);

  const loadCompanyLogo = async () => {
    try {
      const { data: companySettings, error } = await supabase
        .from("company_settings")
        .select("logo_url")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && companySettings?.logo_url) {
        setCompanyLogo(companySettings.logo_url);
      }
    } catch (error) {
      console.error("Error loading company logo:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isUpdatePassword) {
        if (formData.password !== formData.confirmPassword) {
          setError("As senhas não coincidem");
          return;
        }

        const { error } = await supabase.auth.updateUser({
          password: formData.password
        });

        if (error) throw error;

        toast({
          title: "Senha atualizada!",
          description: "Sua senha foi alterada com sucesso.",
        });

        // Redirecionar para a página principal
        navigate("/");
      } else if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/auth`,
        });

        if (error) throw error;

        toast({
          title: "Email enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });

        setIsResetPassword(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          setError("Email ou senha incorretos. Verifique suas credenciais.");
          return;
        }

        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando para o painel...",
        });

        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: formData.name,
              role: formData.role,
            }
          }
        });

        if (error) {
          if (error.message.includes("already registered")) {
            setError("Este email já está cadastrado. Tente fazer login.");
          } else {
            setError("Erro ao criar conta. Verifique os dados e tente novamente.");
          }
          return;
        }

        toast({
          title: "Conta criada com sucesso!",
          description: "Você será redirecionado para fazer login.",
        });

        setIsLogin(true);
        setFormData({ email: "", password: "", confirmPassword: "", name: "", role: "tatico" });
      }
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tactical-dark to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt="Logo da empresa" 
                className="h-20 w-auto max-w-72 object-contain"
              />
            ) : (
              <Shield className="h-12 w-12 text-tactical-green" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground">Sentinela Tático NSA</h1>
          <p className="text-muted-foreground mt-2">
            Sistema de Gestão de Rondas Táticas
          </p>
        </div>

        <Card className="tactical-card">
          <CardHeader>
            <CardTitle className="text-center">
              {isUpdatePassword ? "Nova Senha" : isResetPassword ? "Redefinir Senha" : isLogin ? "Fazer Login" : "Criar Conta"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4 border-tactical-red bg-tactical-red/10">
                <AlertCircle className="h-4 w-4 text-tactical-red" />
                <AlertDescription className="text-tactical-red">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && !isResetPassword && !isUpdatePassword && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Digite seu nome completo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              )}

              {!isUpdatePassword && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Digite seu email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              )}

              {!isResetPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">{isUpdatePassword ? "Nova Senha" : "Senha"}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={isUpdatePassword ? "Digite sua nova senha" : "Digite sua senha"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {isUpdatePassword && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirme sua nova senha"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              {!isLogin && !isResetPassword && !isUpdatePassword && (
                <div className="space-y-2">
                  <Label htmlFor="role">Perfil</Label>
                  <select
                    id="role"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  >
                    <option value="tatico">Tático</option>
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-tactical-green hover:bg-tactical-green/90" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Processando...</span>
                  </div>
                ) : (
                  isUpdatePassword ? "Atualizar Senha" : isResetPassword ? "Enviar Email de Recuperação" : isLogin ? "Entrar" : "Criar Conta"
                )}
              </Button>

              <div className="text-center space-y-2">
                {isLogin && !isUpdatePassword && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setIsResetPassword(true);
                      setIsLogin(false);
                      setError("");
                      setFormData({ email: "", password: "", confirmPassword: "", name: "", role: "tatico" });
                    }}
                    className="text-tactical-blue hover:text-tactical-blue/80"
                  >
                    Esqueceu sua senha?
                  </Button>
                )}
                
                {(isResetPassword || (!isLogin && !isUpdatePassword)) && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setIsLogin(true);
                      setIsResetPassword(false);
                      setIsUpdatePassword(false);
                      setError("");
                      setFormData({ email: "", password: "", confirmPassword: "", name: "", role: "tatico" });
                    }}
                    className="text-tactical-green hover:text-tactical-green/80"
                  >
                    Voltar ao login
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>Sistema de segurança privada</p>
          <p>© 2024 Sentinela Tático NSA</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;