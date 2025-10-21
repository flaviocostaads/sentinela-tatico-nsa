import { Shield, User, Bell, Search, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
const Header = () => {
  const {
    profile,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  return <header className="border-b border-border bg-card/50 backdrop-blur-sm supports-[backdrop-filter]:bg-card/20">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-primary rounded-lg tactical-glow">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sentinela Tático</h1>
            <p className="text-xs text-muted-foreground">NSA Norte Security</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar rondas, táticos, clientes..." className="pl-10 bg-input/50 border-border focus:border-primary transition-tactical" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Theme Toggle */}
          <ThemeToggle />
          
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-tactical-red rounded-full border-2 border-background pulse-tactical"></span>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Settings className="h-5 w-5" />
          </Button>

          {/* User */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-3">
                <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{profile?.name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.role === 'admin' ? 'Administrador' : profile?.role === 'operador' ? 'Operador' : profile?.role === 'tatico' ? 'Tático' : 'Sistema'}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-tactical-red">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>;
};
export default Header;