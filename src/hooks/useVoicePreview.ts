import { useState } from 'react';
import { toast } from 'sonner';

export const useVoicePreview = () => {
  const [isPlaying] = useState(false);
  const [currentlyPlayingVoice] = useState<string | null>(null);

  const playVoicePreview = async (voiceId: string, text: string) => {
    toast.info('Voice preview not available. Generate audio to hear the result.');
  };

  const stopPreview = () => {
    // No-op for backwards compatibility
  };

  return {
    isPlaying,
    currentlyPlayingVoice,
    playVoicePreview,
    stopPreview
  };
};
