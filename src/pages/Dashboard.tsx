
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Plus, Download, Clock, CheckCircle, AlertCircle, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  name: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  duration: string;
  thumbnail?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects] = useState<Project[]>([
    {
      id: '1',
      name: 'Welcome Video',
      status: 'completed',
      createdAt: '2024-01-15',
      duration: '0:45'
    },
    {
      id: '2',
      name: 'Product Demo',
      status: 'processing',
      createdAt: '2024-01-14',
      duration: '1:20'
    }
  ]);

  const [userStats] = useState({
    videosUsed: 2,
    videosLimit: 3,
    remainingVideos: 1
  });

  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: Project['status']) => {
    switch (status) {
      case 'completed':
        return 'Ready';
      case 'processing':
        return 'Processing...';
      case 'failed':
        return 'Failed';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AvatarVoice
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-gray-600">Create amazing avatar videos with AI</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Videos Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {userStats.remainingVideos}
              </div>
              <Progress 
                value={(userStats.videosUsed / userStats.videosLimit) * 100} 
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                {userStats.videosUsed} of {userStats.videosLimit} used
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {projects.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Account Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                Free Plan
              </Badge>
              <p className="text-xs text-gray-500 mt-2">
                Upgrade for unlimited videos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Section */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button 
            size="lg" 
            onClick={() => navigate('/create')}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            disabled={userStats.remainingVideos === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Video
          </Button>
          {userStats.remainingVideos === 0 && (
            <Button size="lg" variant="outline">
              Upgrade Plan
            </Button>
          )}
        </div>

        {/* Projects Section */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Your Projects</CardTitle>
            <CardDescription>
              Manage and download your avatar videos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                <p className="text-gray-600 mb-4">Create your first avatar video to get started</p>
                <Button onClick={() => navigate('/create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Video
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                        <Play className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{project.name}</h4>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          {getStatusIcon(project.status)}
                          <span>{getStatusText(project.status)}</span>
                          <span>•</span>
                          <span>{project.duration}</span>
                          <span>•</span>
                          <span>{project.createdAt}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {project.status === 'completed' && (
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                      {project.status === 'processing' && (
                        <div className="flex items-center space-x-2 text-sm text-yellow-600">
                          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Notice */}
        {userStats.remainingVideos <= 1 && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white mt-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Running low on videos?</h3>
                  <p className="opacity-90">Upgrade to create unlimited avatar videos with premium features</p>
                </div>
                <Button className="bg-white text-purple-600 hover:bg-gray-100">
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
