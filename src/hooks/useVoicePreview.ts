
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useVoicePreview = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentlyPlayingVoice, setCurrentlyPlayingVoice] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const playVoicePreview = async (voiceId: string, text: string) => {
    try {
      // Stop any currently playing audio
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      setIsPlaying(true);
      setCurrentlyPlayingVoice(voiceId);

      // Call our edge function to generate preview audio
      const { data, error } = await supabase.functions.invoke('voice-preview', {
        body: {
          voiceId,
          text: text.substring(0, 100) // Limit preview to first 100 characters
        }
      });

      if (error) {
        throw error;
      }

      if (data?.audioContent) {
        // Convert base64 to blob and create audio URL
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))
        ], { type: 'audio/mpeg' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const newAudio = new Audio(audioUrl);
        
        newAudio.onended = () => {
          setIsPlaying(false);
          setCurrentlyPlayingVoice(null);
          URL.revokeObjectURL(audioUrl);
        };

        newAudio.onerror = () => {
          setIsPlaying(false);
          setCurrentlyPlayingVoice(null);
          URL.revokeObjectURL(audioUrl);
          toast.error('Failed to play voice preview');
        };

        setAudio(newAudio);
        await newAudio.play();
      }
    } catch (error) {
      console.error('Voice preview error:', error);
      toast.error('Failed to generate voice preview');
      setIsPlaying(false);
      setCurrentlyPlayingVoice(null);
    }
  };

  const stopPreview = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentlyPlayingVoice(null);
  };

  return {
    isPlaying,
    currentlyPlayingVoice,
    playVoicePreview,
    stopPreview
  };
};
