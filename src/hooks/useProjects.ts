
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type VideoProject = Tables<'video_projects'>;
export type VideoProjectInsert = TablesInsert<'video_projects'>;

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
    mutationFn: async (project: VideoProjectInsert) => {
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

export const useGenerateVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      script,
      voiceId,
      avatarId
    }: {
      projectId: string;
      script: string;
      voiceId: string;
      avatarId?: string;
    }) => {
      console.log('Calling generate-video function with:', { projectId, script, voiceId, avatarId });
      
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          projectId,
          script,
          voiceId,
          avatarId
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
      toast.success('Video generated successfully!');
    },
    onError: (error) => {
      console.error('Video generation error:', error);
      toast.error('Failed to generate video: ' + error.message);
    }
  });
};
