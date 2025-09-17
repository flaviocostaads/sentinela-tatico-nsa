import { useEffect, useRef, useState } from 'react';

interface EmergencyIncident {
  id: string;
  round_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
}

export const useEmergencyAlert = (activeEmergencies: EmergencyIncident[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Create emergency sound using Web Audio API
  const createEmergencySound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const createBeep = (frequency: number, duration: number, startTime: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    // Create alternating high-low emergency sound pattern
    const playEmergencyPattern = () => {
      const currentTime = audioContext.currentTime;
      createBeep(800, 0.2, currentTime);
      createBeep(600, 0.2, currentTime + 0.3);
      createBeep(800, 0.2, currentTime + 0.6);
      createBeep(600, 0.2, currentTime + 0.9);
    };
    
    return playEmergencyPattern;
  };

  // Check if there are any active high/medium priority emergencies
  const hasActiveAlert = activeEmergencies.some(emergency => 
    emergency.status === 'open' && 
    (emergency.priority === 'medium' || emergency.priority === 'high' || emergency.priority === 'critical')
  );

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (hasActiveAlert && !isPlaying) {
      setIsPlaying(true);
      
      try {
        const playSound = createEmergencySound();
        
        // Play immediately
        playSound();
        
        // Continue playing every 2 seconds
        intervalId = setInterval(() => {
          if (hasActiveAlert) {
            playSound();
          }
        }, 2000);
        
      } catch (error) {
        console.warn('Audio context not available:', error);
      }
      
    } else if (!hasActiveAlert && isPlaying) {
      setIsPlaying(false);
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [hasActiveAlert, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
    };
  }, []);

  return { hasActiveAlert, isPlaying };
};