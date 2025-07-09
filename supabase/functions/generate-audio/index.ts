
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
    console.log('Starting audio generation process');
    
    const { projectId, text, voiceStyle } = await req.json();
    
    if (!projectId || !text || !voiceStyle) {
      throw new Error('Missing required parameters: projectId, text, or voiceStyle');
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
        progress: 10
      })
      .select()
      .single();

    console.log('Created processing job:', job?.id);

    // Map voice styles to Kokoro TTS parameters
    const voiceStyleMapping = {
      "normal": { voice: "af_bella", speed: 1.0, emotion: "neutral" },
      "vlog": { voice: "af_sarah", speed: 1.1, emotion: "excited" },
      "pdf": { voice: "bf_emma", speed: 0.9, emotion: "neutral" },
      "announcer": { voice: "am_adam", speed: 1.0, emotion: "bold" },
      "narrator": { voice: "am_michael", speed: 0.95, emotion: "dramatic" },
      "assistant": { voice: "af_sky", speed: 1.0, emotion: "helpful" }
    };

    const voiceConfig = voiceStyleMapping[voiceStyle] || voiceStyleMapping["normal"];
    
    // Generate audio with Replicate Kokoro TTS
    console.log('Generating audio with Replicate Kokoro TTS');
    
    const replicateApiKey = Deno.env.get('REPLICATE_API_KEY');
    if (!replicateApiKey) {
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "a5836f6db16e7bbc0caf668d87a98fa4b534d7e2ae9c9b508abe1e12f2d43349", // Kokoro TTS version
        input: {
          text: text,
          voice: voiceConfig.voice,
          speed: voiceConfig.speed,
          emotion: voiceConfig.emotion
        }
      }),
    });

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      throw new Error(`Replicate API error: ${errorText}`);
    }

    const replicateData = await replicateResponse.json();
    console.log('Replicate prediction started:', replicateData.id);

    // Update progress to 50%
    await supabase
      .from('processing_jobs')
      .update({ progress: 50 })
      .eq('id', job?.id);

    // Poll for completion
    let audioUrl = null;
    let attempts = 0;
    const maxAttempts = 30; // 2.5 minutes max

    while (attempts < maxAttempts && !audioUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${replicateData.id}`, {
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.error('Failed to check Replicate status');
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      console.log('Replicate status:', statusData.status);

      if (statusData.status === 'succeeded' && statusData.output) {
        audioUrl = statusData.output;
        break;
      } else if (statusData.status === 'failed') {
        throw new Error(`Replicate audio generation failed: ${statusData.error || 'Unknown error'}`);
      }

      attempts++;
      
      // Update progress based on attempts
      const progressIncrement = Math.min(40, Math.floor((attempts / maxAttempts) * 40));
      await supabase
        .from('processing_jobs')
        .update({ progress: 50 + progressIncrement })
        .eq('id', job?.id);
    }

    if (!audioUrl) {
      throw new Error('Audio generation timed out');
    }

    console.log('Audio generated successfully:', audioUrl);

    // Update progress to 100%
    await supabase
      .from('processing_jobs')
      .update({ progress: 100 })
      .eq('id', job?.id);

    // Update project with completion data
    console.log('Finalizing audio project');
    
    const estimatedDuration = Math.ceil(text.length / 15);
    
    await supabase
      .from('video_projects')
      .update({
        status: 'completed',
        video_url: audioUrl, // We'll use video_url to store audio URL for now
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

    console.log('Audio generation completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Audio generated successfully with Kokoro TTS',
      audioUrl: audioUrl,
      duration: estimatedDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-audio function:', error);
    
    // Try to update the project status to failed if we have the projectId
    try {
      const body = await req.clone().json();
      const { projectId } = body;
      if (projectId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('video_projects')
          .update({ status: 'failed' })
          .eq('id', projectId);

        // Also update processing job
        const { data: jobs } = await supabase
          .from('processing_jobs')
          .select('id')
          .eq('project_id', projectId)
          .eq('status', 'processing');

        if (jobs && jobs.length > 0) {
          await supabase
            .from('processing_jobs')
            .update({ 
              status: 'failed', 
              error_message: error.message 
            })
            .eq('id', jobs[0].id);
        }
      }
    } catch (updateError) {
      console.error('Failed to update project status:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate audio'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
