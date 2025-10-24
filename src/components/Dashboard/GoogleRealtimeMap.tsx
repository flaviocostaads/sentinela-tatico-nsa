import { useEffect, useRef, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Users, AlertTriangle, RefreshCw, Maximize2, X, Search, ExternalLink } from 'lucide-react';
import { useRealtimeMap } from '@/hooks/useRealtimeMap';
import { useToast } from '@/hooks/use-toast';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

interface GoogleRealtimeMapProps {
  apiKey: string;
  defaultCity?: string;
  isExpanded?: boolean;
  onClose?: () => void;
  onOpenNewWindow?: () => void;
}

const GoogleRealtimeMap = ({ apiKey, defaultCity = 'São Paulo, SP, Brasil', isExpanded = false, onClose, onOpenNewWindow }: GoogleRealtimeMapProps) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { userLocations, clients, activeEmergencies, lastUpdateTime, fetchAllData } = useRealtimeMap();
  const { toast } = useToast();

  // Geocode the default city on mount
  useEffect(() => {
    if (defaultCity && window.google?.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: defaultCity }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          setMapCenter({
            lat: location.lat(),
            lng: location.lng(),
          });
        }
      });
    }
  }, [defaultCity]);

  const toggleFullscreen = () => {
    const mapElement = document.getElementById('google-realtime-map-container');
    if (!mapElement) return;

    if (!isFullscreen) {
      if (mapElement.requestFullscreen) {
        mapElement.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Digite um nome",
        description: "Por favor, digite o nome da empresa para buscar",
        variant: "destructive",
      });
      return;
    }

    const foundClient = clients.find(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (foundClient && foundClient.lat && foundClient.lng && mapRef.current) {
      const position = { lat: foundClient.lat, lng: foundClient.lng };
      mapRef.current.panTo(position);
      mapRef.current.setZoom(16);
      setSelectedMarker(foundClient);

      toast({
        title: "Empresa encontrada",
        description: `Mostrando localização de ${foundClient.name}`,
      });
    } else {
      toast({
        title: "Empresa não encontrada",
        description: "Nenhuma empresa encontrada com esse nome",
        variant: "destructive",
      });
    }
  };

  const renderContent = () => (
    <div className="h-full relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={12}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: false,
        }}
      >
        {/* Client Markers */}
        {clients.map((client) => (
          client.lat && client.lng && (
            <Marker
              key={client.id}
              position={{ lat: client.lat, lng: client.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 8,
              }}
              onClick={() => setSelectedMarker(client)}
            />
          )
        ))}

        {/* User Location Markers */}
        {userLocations.map((location) => (
          <Marker
            key={location.id}
            position={{ lat: location.lat, lng: location.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: location.rounds ? '#10b981' : '#6b7280',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 10,
            }}
            onClick={() => setSelectedMarker(location)}
          />
        ))}

        {/* Emergency Markers */}
        {activeEmergencies.filter(e => e.lat && e.lng).map((emergency) => (
          <Marker
            key={emergency.id}
            position={{ lat: Number(emergency.lat), lng: Number(emergency.lng) }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: emergency.priority === 'critical' ? '#dc2626' : '#f59e0b',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 12,
            }}
            onClick={() => setSelectedMarker(emergency)}
          />
        ))}

        {/* Info Window */}
        {selectedMarker && (
          <InfoWindow
            position={{
              lat: selectedMarker.lat,
              lng: selectedMarker.lng,
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2">
              <h3 className="font-bold text-sm">
                {selectedMarker.name || selectedMarker.title || 'Localização'}
              </h3>
              {selectedMarker.address && (
                <p className="text-xs text-gray-600">{selectedMarker.address}</p>
              )}
              {selectedMarker.description && (
                <p className="text-xs text-gray-600 mt-1">{selectedMarker.description}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Stats Overlay */}
      <div className="absolute top-4 left-4 right-4 flex gap-2 pointer-events-none">
        <Badge className="bg-background/90 backdrop-blur pointer-events-auto">
          <Users className="w-3 h-3 mr-1" />
          {userLocations.length} Táticos
        </Badge>
        <Badge className="bg-background/90 backdrop-blur pointer-events-auto">
          <MapPin className="w-3 h-3 mr-1" />
          {clients.length} Clientes
        </Badge>
        {activeEmergencies.length > 0 && (
          <Badge variant="destructive" className="bg-background/90 backdrop-blur pointer-events-auto">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {activeEmergencies.length} Emergências
          </Badge>
        )}
      </div>
    </div>
  );

  if (isExpanded || isFullscreen) {
    return (
      <div 
        id="google-realtime-map-container"
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-xl font-bold">Mapa em Tempo Real - Google Maps</h2>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Input
                placeholder="Buscar empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button size="sm" onClick={handleSearch}>
                <Search className="w-4 h-4 mr-1" />
                Localizar
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAllData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleFullscreen}
            >
              <Maximize2 className="w-4 h-4 mr-1" />
              Tela Cheia
            </Button>
            {onOpenNewWindow && (
              <Button variant="outline" size="sm" onClick={onOpenNewWindow}>
                <ExternalLink className="w-4 h-4 mr-1" />
                Abrir em Nova Janela
              </Button>
            )}
            {(onClose || isFullscreen) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={isFullscreen ? toggleFullscreen : onClose}
              >
                <X className="w-4 h-4 mr-1" />
                {isFullscreen ? 'Sair da Tela Cheia' : 'Fechar'}
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <Card className="h-[600px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-4 flex-1">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Mapa em Tempo Real - Google Maps
          </CardTitle>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              placeholder="Buscar empresa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-8"
            />
            <Button size="sm" variant="outline" onClick={handleSearch}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleFullscreen}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-80px)]">
        {renderContent()}
      </CardContent>
    </Card>
  );
};

const GoogleRealtimeMapWrapper = (props: GoogleRealtimeMapProps) => {
  return (
    <LoadScript googleMapsApiKey={props.apiKey} loadingElement={<div>Carregando mapa...</div>}>
      <GoogleRealtimeMap {...props} />
    </LoadScript>
  );
};

export default GoogleRealtimeMapWrapper;
