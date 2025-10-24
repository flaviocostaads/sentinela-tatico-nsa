import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMapProvider, MapProvider } from '@/hooks/useMapProvider';
import { InfoIcon, MapPin, Navigation } from 'lucide-react';

const MapProviderSettings = () => {
  const { provider, googleMapsApiKey, loading, updateMapProvider } = useMapProvider();
  const [selectedProvider, setSelectedProvider] = useState<MapProvider>('mapbox');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSelectedProvider(provider);
      setApiKey(googleMapsApiKey || '');
    }
  }, [provider, googleMapsApiKey, loading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMapProvider(selectedProvider, selectedProvider === 'google' ? apiKey : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Provedor de Mapa
        </CardTitle>
        <CardDescription>
          Configure qual provedor de mapa será utilizado no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Alterar o provedor de mapa recarregará a aplicação.
            Google Maps oferece funcionalidades avançadas como cálculo de rotas, tempo de chegada e mais.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Label>Selecione o Provedor</Label>
          <RadioGroup
            value={selectedProvider}
            onValueChange={(value) => setSelectedProvider(value as MapProvider)}
          >
            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent">
              <RadioGroupItem value="mapbox" id="mapbox" />
              <Label htmlFor="mapbox" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <div>
                    <p className="font-medium">Mapbox</p>
                    <p className="text-sm text-muted-foreground">
                      Mapa básico com visualização de localização e marcadores
                    </p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent">
              <RadioGroupItem value="google" id="google" />
              <Label htmlFor="google" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4" />
                  <div>
                    <p className="font-medium">Google Maps</p>
                    <p className="text-sm text-muted-foreground">
                      Funcionalidades avançadas: rotas, direções, tempo de chegada, street view
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {selectedProvider === 'google' && (
          <div className="space-y-4 p-4 border rounded-lg bg-accent/50">
            <div className="space-y-2">
              <Label htmlFor="google-api-key">Google Maps API Key</Label>
              <Input
                id="google-api-key"
                type="password"
                placeholder="Insira sua Google Maps API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Obtenha sua API key em:{' '}
                <a
                  href="https://console.cloud.google.com/google/maps-apis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>

            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>APIs necessárias:</strong> Certifique-se de ativar as seguintes APIs no Google Cloud:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Maps JavaScript API</li>
                  <li>Directions API (para rotas)</li>
                  <li>Distance Matrix API (para cálculo de distância/tempo)</li>
                  <li>Places API (para busca de locais)</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || (selectedProvider === 'google' && !apiKey.trim())}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapProviderSettings;
