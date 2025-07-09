
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

  let requestBody;
  try {
    console.log('Starting audio generation process');
    
    // Parse request body once and store it
    requestBody = await req.json();
    const { projectId, text, voiceStyle } = requestBody;
    
    if (!projectId || !text || !voiceStyle) {
      throw new Error('Missing required parameters: projectId, text, or voiceStyle');
    }

    console.log(`Received request - Project: ${projectId}, Voice: ${voiceStyle}, Text length: ${text.length}`);

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

    // Check Replicate API key
    const replicateApiKey = Deno.env.get('REPLICATE_API_KEY');
    if (!replicateApiKey) {
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    console.log('Replicate API key found, proceeding with generation');

    // Voice style mapping for Facebook MMS TTS model (free model)
    const voiceStyleMapping = {
      "normal": { voice: "eng", speed: 1.0 },
      "vlog": { voice: "eng", speed: 1.1 },
      "pdf": { voice: "eng", speed: 0.9 },
      "announcer": { voice: "eng", speed: 1.0 },
      "narrator": { voice: "eng", speed: 0.95 },
      "assistant": { voice: "eng", speed: 1.0 }
    };

    const voiceConfig = voiceStyleMapping[voiceStyle] || voiceStyleMapping["normal"];
    console.log('Using voice config:', voiceConfig);
    
    // Generate audio with Replicate using Facebook MMS TTS (free model)
    console.log('Generating audio with Facebook MMS TTS');
    
    const replicatePayload = {
      version: "fb9020c90c203be1f773b2d4c6698de742e5c35c64ad3de1bbce00a4cbee34b4",
      input: {
        text: text,
        language: voiceConfig.voice
      }
    };

    console.log('Replicate payload:', JSON.stringify(replicatePayload, null, 2));

    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(replicatePayload),
    });

    console.log('Replicate response status:', replicateResponse.status);

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      console.error('Replicate API error response:', errorText);
      throw new Error(`Replicate API error (${replicateResponse.status}): ${errorText}`);
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

    console.log('Starting polling for completion...');

    while (attempts < maxAttempts && !audioUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      console.log(`Polling attempt ${attempts + 1}/${maxAttempts}`);
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${replicateData.id}`, {
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.error('Failed to check Replicate status:', statusResponse.status);
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      console.log('Replicate status:', statusData.status, 'Progress:', statusData.progress);

      if (statusData.status === 'succeeded' && statusData.output) {
        audioUrl = statusData.output;
        console.log('Audio generation completed, URL:', audioUrl);
        break;
      } else if (statusData.status === 'failed') {
        console.error('Replicate generation failed:', statusData.error);
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
      throw new Error('Audio generation timed out after 2.5 minutes');
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
      message: 'Audio generated successfully with Facebook MMS TTS',
      audioUrl: audioUrl,
      duration: estimatedDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-audio function:', error);
    
    // Try to update the project status to failed if we have the projectId
    try {
      const { projectId } = requestBody || {};
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
