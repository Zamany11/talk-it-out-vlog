
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceId, text } = await req.json();
    
    if (!voiceId || !text) {
      throw new Error('Missing voiceId or text parameter');
    }

    console.log('Generating voice preview with Coqui TTS for voice:', voiceId);

    // Map voice IDs to Coqui TTS voice names
    const voiceMapping = {
      "9BWtsMINqrJLrRacOk9x": "tts_models/en/ljspeech/tacotron2-DDC", // Aria -> Female voice
      "CwhRBWXzGAHq8TQ4Fs17": "tts_models/en/vctk/vits", // Roger -> Male British voice
      "EXAVITQu4vr4xnSDxMaL": "tts_models/en/ljspeech/glow-tts", // Sarah -> Female voice
      "TX3LPaxmHKxFdv7VOQHJ": "tts_models/en/ljspeech/speedy-speech" // Liam -> Male voice
    };

    const coquiModel = voiceMapping[voiceId] || "tts_models/en/ljspeech/tacotron2-DDC";
    const coquiApiUrl = Deno.env.get('COQUI_TTS_URL') || 'http://localhost:5002';

    try {
      const ttsResponse = await fetch(`${coquiApiUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.substring(0, 100), // Limit preview text
          model_name: coquiModel,
          speaker_idx: voiceId.includes('female') || voiceId === "9BWtsMINqrJLrRacOk9x" || voiceId === "EXAVITQu4vr4xnSDxMaL" ? 0 : 1
        }),
      });

      if (!ttsResponse.ok) {
        console.log('Coqui TTS API not available, providing fallback response');
        
        // Return a fallback response indicating Coqui TTS needs to be set up
        return new Response(JSON.stringify({ 
          error: 'Coqui TTS server not available. Please set up Coqui TTS server for voice preview functionality.',
          fallback: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      
      // Convert to base64 for frontend consumption
      const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      
      console.log('Voice preview generated successfully with Coqui TTS');
      
      return new Response(JSON.stringify({ 
        audioContent: audioBase64,
        message: 'Voice preview generated with Coqui TTS'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (coquiError) {
      console.error('Coqui TTS error:', coquiError);
      
      // Return fallback response
      return new Response(JSON.stringify({ 
        error: 'Coqui TTS server error. Please ensure Coqui TTS is properly configured.',
        details: coquiError.message,
        fallback: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in voice-preview function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate voice preview'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
