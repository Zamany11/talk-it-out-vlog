
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type AudioProject = Tables<'video_projects'>; // We'll reuse the existing table for now
export type AudioProjectInsert = TablesInsert<'video_projects'>;

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (project: AudioProjectInsert) => {
      const { data, error } = await supabase
        .from('video_projects')
        .insert([project])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create project: ' + error.message);
    }
  });
};

export const useGenerateAudio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      text,
      voiceStyle
    }: {
      projectId: string;
      text: string;
      voiceStyle: string;
    }) => {
      console.log('Calling generate-audio function with:', { projectId, text, voiceStyle });
      
      const { data, error } = await supabase.functions.invoke('generate-audio', {
        body: {
          projectId,
          text,
          voiceStyle
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });      
      toast.success('Audio generated successfully!');
    },
    onError: (error) => {
      console.error('Audio generation error:', error);
      toast.error('Failed to generate audio: ' + error.message);
    }
  });
};
