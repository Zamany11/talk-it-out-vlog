
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Download, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import VideoPlayer from './VideoPlayer';
import type { VideoProject } from '@/hooks/useProjects';

interface ProjectCardProps {
  project: VideoProject;
}

const ProjectCard = ({ project }: ProjectCardProps) => {
  const [showPreview, setShowPreview] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Ready';
      case 'processing':
        return 'Processing...';
      case 'failed':
        return 'Failed';
      case 'draft':
        return 'Draft';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleDownload = async () => {
    if (!project.video_url) return;
    
    try {
      const response = await fetch(project.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
              <Play className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">{project.title}</h4>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                {getStatusIcon(project.status || 'draft')}
                <Badge variant="secondary" className="text-xs">
                  {getStatusText(project.status || 'draft')}
                </Badge>
                <span>•</span>
                <span>
                  {project.duration_seconds 
                    ? `${Math.floor(project.duration_seconds / 60)}:${(project.duration_seconds % 60).toString().padStart(2, '0')}` 
                    : 'N/A'
                  }
                </span>
                <span>•</span>
                <span>{formatDate(project.created_at || '')}</span>
              </div>
              {project.script && (
                <p className="text-sm text-gray-600 mt-1 truncate max-w-md">
                  "{project.script.substring(0, 100)}{project.script.length > 100 ? '...' : ''}"
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {project.status === 'completed' && project.video_url && (
              <>
                <Dialog open={showPreview} onOpenChange={setShowPreview}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{project.title}</DialogTitle>
                    </DialogHeader>
                    <VideoPlayer
                      videoUrl={project.video_url}
                      title={project.title}
                      duration={project.duration_seconds || undefined}
                    />
                  </DialogContent>
                </Dialog>
                
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </>
            )}
            
            {project.status === 'processing' && (
              <div className="flex items-center space-x-2 text-sm text-yellow-600">
                <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </div>
            )}
            
            {project.status === 'failed' && (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;
