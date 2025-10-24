import { useMapProvider } from '@/hooks/useMapProvider';
import RealtimeMap from './RealtimeMap';
import GoogleRealtimeMap from './GoogleRealtimeMap';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface MapProviderWrapperProps {
  isExpanded?: boolean;
  onClose?: () => void;
  onOpenNewWindow?: () => void;
}

const MapProviderWrapper = (props: MapProviderWrapperProps) => {
  const { provider, googleMapsApiKey, loading } = useMapProvider();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">Carregando configuração do mapa...</p>
      </div>
    );
  }

  if (provider === 'google') {
    if (!googleMapsApiKey) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Google Maps selecionado mas a API Key não está configurada. 
            Por favor, configure a API Key nas Configurações.
          </AlertDescription>
        </Alert>
      );
    }

    return <GoogleRealtimeMap apiKey={googleMapsApiKey} {...props} />;
  }

  return <RealtimeMap {...props} />;
};

export default MapProviderWrapper;
