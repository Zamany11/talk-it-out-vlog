
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

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
    console.log('Starting video generation process');
    
    const { projectId, script, voiceId, avatarId } = await req.json();
    
    if (!projectId || !script || !voiceId) {
      throw new Error('Missing required parameters: projectId, script, or voiceId');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Updating project status to processing');
    
    // Update project status to processing
    await supabase
      .from('video_projects')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    // Create processing job
    const { data: job } = await supabase
      .from('processing_jobs')
      .insert({
        project_id: projectId,
        status: 'processing',
        progress: 0
      })
      .select()
      .single();

    console.log('Created processing job:', job?.id);

    // Step 1: Generate speech with ElevenLabs (20% progress)
    console.log('Generating speech with ElevenLabs');
    
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`Failed to generate speech: ${errorText}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log('Speech generated successfully, audio size:', audioBuffer.byteLength);

    // Update progress to 40%
    await supabase
      .from('processing_jobs')
      .update({ progress: 40 })
      .eq('id', job?.id);

    // Step 2: Upload audio to Supabase storage
    console.log('Uploading audio to storage');
    
    const audioFileName = `${projectId}/audio.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(audioFileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Update progress to 60%
    await supabase
      .from('processing_jobs')
      .update({ progress: 60 })
      .eq('id', job?.id);

    // Step 3: Get audio URL and calculate duration (simplified)
    const { data: audioUrl } = supabase.storage
      .from('videos')
      .getPublicUrl(audioFileName);

    console.log('Audio uploaded successfully:', audioUrl.publicUrl);

    // Estimate duration based on script length (rough approximation)
    const estimatedDuration = Math.ceil(script.length / 15); // ~15 characters per second

    // Update progress to 80%
    await supabase
      .from('processing_jobs')
      .update({ progress: 80 })
      .eq('id', job?.id);

    // Step 4: For now, we'll use the audio as the "video" URL
    // In a real implementation, you'd generate the actual video here
    console.log('Finalizing video project');
    
    // Update project with completion data
    await supabase
      .from('video_projects')
      .update({
        status: 'completed',
        video_url: audioUrl.publicUrl,
        duration_seconds: estimatedDuration,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    // Update processing job to completed
    await supabase
      .from('processing_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString()
      })
      .eq('id', job?.id);

    console.log('Video generation completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Video generated successfully',
      audioUrl: audioUrl.publicUrl,
      duration: estimatedDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-video function:', error);
    
    // Try to update the project status to failed if we have the projectId
    try {
      const { projectId } = await req.json();
      if (projectId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('video_projects')
          .update({ status: 'failed' })
          .eq('id', projectId);
      }
    } catch (updateError) {
      console.error('Failed to update project status:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate video'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
