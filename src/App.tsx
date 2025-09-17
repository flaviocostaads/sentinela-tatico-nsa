import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import EmergencyPopup from "@/components/TacticApp/EmergencyPopup";
import AdminEmergencyAlert from "@/components/Dashboard/AdminEmergencyAlert";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import Users from "./pages/Users";
import NotFound from "./pages/NotFound";
import Rounds from "./pages/Rounds";
import MapViewPage from "./pages/MapView";
import History from "./pages/History";
import Reports from "./pages/Reports";
import Incidents from "./pages/Incidents";
import Vehicles from "./pages/Vehicles";
import VehicleDetails from "./pages/VehicleDetails";
import VehicleHistory from "./pages/VehicleHistory";
import TacticApp from "./pages/TacticApp";
import AuditLogs from "./pages/AuditLogs";
import VehicleMaintenanceReports from "./pages/VehicleMaintenanceReports";
import FuelManagement from "./pages/FuelManagement";
import MaintenanceManagement from "./pages/MaintenanceManagement";
import RoundTemplates from "./pages/RoundTemplates";
import Settings from "./pages/Settings";
import QRScannerPage from "./pages/QRScanner";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-tactical-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Component to handle role-based redirection
const RoleBasedRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  const location = window.location;
  
  // Detect if it's mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   window.innerWidth <= 768;
  
  // If user is tático and on mobile, redirect to /tactic (except if already there)
  if (!loading && profile?.role === 'tatico' && isMobile && location.pathname === '/') {
    return <Navigate to="/tactic" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <EmergencyPopup />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <RoleBasedRoute>
                    <Index />
                  </RoleBasedRoute>
                </ProtectedRoute>
              } />
              <Route path="/clients" element={
                <ProtectedRoute>
                  <Clients />
                </ProtectedRoute>
              } />
              <Route path="/users" element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/rounds" element={
                <ProtectedRoute>
                  <Rounds />
                </ProtectedRoute>
              } />
              <Route path="/map" element={
                <ProtectedRoute>
                  <MapViewPage />
                </ProtectedRoute>
              } />
              <Route path="/history" element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/incidents" element={
                <ProtectedRoute>
                  <Incidents />
                </ProtectedRoute>
              } />
              <Route path="/vehicles" element={
                <ProtectedRoute>
                  <Vehicles />
                </ProtectedRoute>
              } />
              <Route path="/vehicle-details/:id" element={
                <ProtectedRoute>
                  <VehicleDetails />
                </ProtectedRoute>
              } />
              <Route path="/vehicle-history" element={
                <ProtectedRoute>
                  <VehicleHistory />
                </ProtectedRoute>
              } />
              <Route path="/tactic" element={
                <ProtectedRoute>
                  <TacticApp />
                </ProtectedRoute>
              } />
              <Route path="/audit-logs" element={
                <ProtectedRoute>
                  <AuditLogs />
                </ProtectedRoute>
              } />
              <Route path="/vehicles/:vehicleId/maintenance" element={
                <ProtectedRoute>
                  <VehicleMaintenanceReports />
                </ProtectedRoute>
              } />
              <Route path="/fuel-management" element={
                <ProtectedRoute>
                  <FuelManagement />
                </ProtectedRoute>
              } />
              <Route path="/maintenance-management" element={
                <ProtectedRoute>
                  <MaintenanceManagement />
                </ProtectedRoute>
              } />
              <Route path="/round-templates" element={
                <ProtectedRoute>
                  <RoundTemplates />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/qr-scanner" element={
                <ProtectedRoute>
                  <QRScannerPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
