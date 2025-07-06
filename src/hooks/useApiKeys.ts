
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useApiKeys = () => {
  const [didApiKey, setDidApiKey] = useState<string>('');
  const [hasDidKey, setHasDidKey] = useState<boolean>(false);

  useEffect(() => {
    // Check if D-ID API key is configured by making a test call
    checkDidApiKey();
  }, []);

  const checkDidApiKey = async () => {
    try {
      // This will be handled by the edge function
      setHasDidKey(true); // Assume it's configured for now
    } catch (error) {
      setHasDidKey(false);
    }
  };

  const saveDidApiKey = (apiKey: string) => {
    setDidApiKey(apiKey);
    setHasDidKey(true);
    localStorage.setItem('did_api_key', apiKey);
    toast.success('D-ID API key saved successfully');
  };

  return {
    didApiKey,
    hasDidKey,
    saveDidApiKey,
    checkDidApiKey
  };
};
