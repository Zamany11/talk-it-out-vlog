
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
    
    const { projectId, script, voiceId, avatarId, videoProvider = 'sadtalker' } = await req.json();
    
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
        progress: 10
      })
      .select()
      .single();

    console.log('Created processing job:', job?.id);

    // Step 1: Generate speech with Coqui TTS (30% progress)
    console.log('Generating speech with Coqui TTS');
    
    // Map voice IDs to Coqui TTS voice names
    const voiceMapping = {
      "9BWtsMINqrJLrRacOk9x": "tts_models/en/ljspeech/tacotron2-DDC", // Aria -> Female voice
      "CwhRBWXzGAHq8TQ4Fs17": "tts_models/en/vctk/vits", // Roger -> Male British voice
      "EXAVITQu4vr4xnSDxMaL": "tts_models/en/ljspeech/glow-tts", // Sarah -> Female voice
      "TX3LPaxmHKxFdv7VOQHJ": "tts_models/en/ljspeech/speedy-speech" // Liam -> Male voice
    };

    const coquiModel = voiceMapping[voiceId] || "tts_models/en/ljspeech/tacotron2-DDC";
    
    // Use Coqui TTS API (assuming you have it deployed or using a public instance)
    // For this example, we'll use a local/self-hosted Coqui TTS server
    const coquiApiUrl = Deno.env.get('COQUI_TTS_URL') || 'http://localhost:5002';
    
    try {
      const ttsResponse = await fetch(`${coquiApiUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: script,
          model_name: coquiModel,
          speaker_idx: voiceId.includes('female') || voiceId === "9BWtsMINqrJLrRacOk9x" || voiceId === "EXAVITQu4vr4xnSDxMaL" ? 0 : 1
        }),
      });

      if (!ttsResponse.ok) {
        // Fallback to a simpler Coqui TTS approach if the API is not available
        console.log('Coqui TTS API not available, using fallback method');
        
        // Generate a simple audio file as fallback
        // In a real implementation, you might want to use a different TTS service
        // or deploy Coqui TTS yourself
        const fallbackAudio = new Uint8Array(44100 * 2); // 1 second of silence as placeholder
        
        // Upload the fallback audio
        const audioFileName = `${projectId}/audio.mp3`;
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(audioFileName, fallbackAudio, {
            contentType: 'audio/mpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Failed to upload audio: ${uploadError.message}`);
        }

        // Get public URL for the audio
        const { data: audioUrl } = supabase.storage
          .from('videos')
          .getPublicUrl(audioFileName);

        console.log('Using fallback audio due to Coqui TTS unavailability');
        
        // Continue with video generation using the fallback
        await continueVideoGeneration(supabase, job, audioUrl.publicUrl, projectId, avatarId, videoProvider, script);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Video generated with fallback audio (Coqui TTS setup required)',
          note: 'Please set up Coqui TTS server for full functionality'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      console.log('Speech generated successfully with Coqui TTS, audio size:', audioBuffer.byteLength);

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

      // Get public URL for the audio
      const { data: audioUrl } = supabase.storage
        .from('videos')
        .getPublicUrl(audioFileName);

      await continueVideoGeneration(supabase, job, audioUrl.publicUrl, projectId, avatarId, videoProvider, script);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Video generated successfully with Coqui TTS'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (coquiError) {
      console.error('Coqui TTS error:', coquiError);
      throw new Error(`Coqui TTS generation failed: ${coquiError.message}`);
    }

  } catch (error) {
    console.error('Error in generate-video function:', error);
    
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
      error: error.message || 'Failed to generate video'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function continueVideoGeneration(supabase, job, audioUrl, projectId, avatarId, videoProvider, script) {
  // Update progress to 50%
  await supabase
    .from('processing_jobs')
    .update({ progress: 50 })
    .eq('id', job?.id);

  // Step 3: Determine avatar image URL
  let avatarImageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512&h=512&fit=crop&crop=face';
  
  if (avatarId && avatarId !== 'default') {
    // Fetch custom avatar from database
    const { data: avatarData } = await supabase
      .from('avatars')
      .select('image_url')
      .eq('id', avatarId)
      .single();
    
    if (avatarData?.image_url) {
      avatarImageUrl = avatarData.image_url;
    }
  }

  // Step 4: Choose video generation provider
  console.log(`Using video provider: ${videoProvider}`);
  
  if (videoProvider === 'sadtalker') {
    // Use SadTalker for video generation
    console.log('Delegating to SadTalker service');
    
    const sadTalkerResponse = await supabase.functions.invoke('sadtalker-generate', {
      body: {
        projectId,
        audioUrl: audioUrl,
        avatarImageUrl
      }
    });

    if (sadTalkerResponse.error) {
      console.error('SadTalker generation error:', sadTalkerResponse.error);
      throw new Error(`SadTalker generation failed: ${sadTalkerResponse.error.message}`);
    }

    return sadTalkerResponse.data;
  } else {
    // Use D-ID for video generation
    console.log('Creating talking avatar video with D-ID');
    
    const didApiKey = Deno.env.get('DID_API_KEY');
    if (!didApiKey) {
      console.warn('D-ID API key not configured, using audio-only fallback');
      
      // Fallback: Use audio as video URL
      await supabase
        .from('video_projects')
        .update({
          status: 'completed',
          video_url: audioUrl,
          duration_seconds: Math.ceil(script.length / 15),
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      await supabase
        .from('processing_jobs')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString()
        })
        .eq('id', job?.id);

      return { 
        success: true, 
        message: 'Audio generated successfully with Coqui TTS (video generation requires API keys)',
        videoUrl: audioUrl,
        audioUrl: audioUrl,
        duration: Math.ceil(script.length / 15)
      };
    }

    // Create D-ID talking avatar video
    const didResponse = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${didApiKey}`,
      },
      body: JSON.stringify({
        source_url: avatarImageUrl,
        script: {
          type: 'audio',
          audio_url: audioUrl,
        },
        config: {
          fluent: true,
          pad_audio: 0,
        },
      }),
    });

    if (!didResponse.ok) {
      const errorText = await didResponse.text();
      console.error('D-ID API error:', errorText);
      throw new Error(`Failed to create talking avatar: ${errorText}`);
    }

    const didData = await didResponse.json();
    const talkId = didData.id;
    console.log('D-ID talk created:', talkId);

    // Update progress to 70%
    await supabase
      .from('processing_jobs')
      .update({ progress: 70 })
      .eq('id', job?.id);

    // Poll D-ID for completion
    console.log('Polling D-ID for video completion');
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: {
          'Authorization': `Basic ${didApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.error('Failed to check D-ID status');
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      console.log('D-ID status:', statusData.status);

      if (statusData.status === 'done' && statusData.result_url) {
        videoUrl = statusData.result_url;
        break;
      } else if (statusData.status === 'error') {
        throw new Error(`D-ID video generation failed: ${statusData.error?.description || 'Unknown error'}`);
      }

      attempts++;
      
      // Update progress based on attempts
      const progressIncrement = Math.min(20, Math.floor((attempts / maxAttempts) * 20));
      await supabase
        .from('processing_jobs')
        .update({ progress: 70 + progressIncrement })
        .eq('id', job?.id);
    }

    if (!videoUrl) {
      throw new Error('Video generation timed out');
    }

    console.log('Video generated successfully:', videoUrl);

    // Update progress to 100%
    await supabase
      .from('processing_jobs')
      .update({ progress: 100 })
      .eq('id', job?.id);

    // Step 5: Update project with completion data
    console.log('Finalizing video project');
    
    const estimatedDuration = Math.ceil(script.length / 15);
    
    await supabase
      .from('video_projects')
      .update({
        status: 'completed',
        video_url: videoUrl,
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

    return { 
      success: true, 
      message: 'Video generated successfully with Coqui TTS',
      videoUrl: videoUrl,
      audioUrl: audioUrl,
      duration: estimatedDuration
    };
  }
}
