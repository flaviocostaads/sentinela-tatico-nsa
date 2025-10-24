import MapProviderWrapper from '@/components/Dashboard/MapProviderWrapper';

const MapFullscreen = () => {
  return (
    <div className="w-screen h-screen">
      <MapProviderWrapper 
        isExpanded={true} 
        onClose={() => window.close()}
      />
    </div>
  );
};

export default MapFullscreen;
