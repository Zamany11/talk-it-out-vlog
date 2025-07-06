
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, ArrowLeft, Upload, Mic, User, Volume2, Image as ImageIcon, Wand2, Pause, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateProject, useGenerateVideo } from "@/hooks/useProjects";
import { useVoicePreview } from "@/hooks/useVoicePreview";

const Create = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [script, setScript] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("default");
  const [videoProvider, setVideoProvider] = useState("sadtalker");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const createProject = useCreateProject();
  const generateVideo = useGenerateVideo();
  const { isPlaying, currentlyPlayingVoice, playVoicePreview, stopPreview } = useVoicePreview();

  const maxCharacters = 5000;
  
  // ElevenLabs voice IDs and names
  const voices = [
    { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", gender: "Female", accent: "American" },
    { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "Male", accent: "British" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Female", accent: "American" },
    { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "Male", accent: "American" }
  ];

  const avatars = [
    { id: "default", name: "Professional Avatar", preview: "/placeholder.svg", description: "AI-generated professional avatar" },
    { id: "custom", name: "Upload Custom Image", preview: null, description: "Upload your own avatar image" }
  ];

  const videoProviders = [
    { 
      id: "sadtalker", 
      name: "SadTalker", 
      description: "Open-source, cost-effective solution",
      badge: "Recommended",
      badgeVariant: "default" as const
    },
    { 
      id: "did", 
      name: "D-ID", 
      description: "Professional service (requires API key)",
      badge: "Premium",
      badgeVariant: "secondary" as const
    }
  ];

  const handleScriptChange = (value: string) => {
    if (value.length <= maxCharacters) {
      setScript(value);
    }
  };

  const handleGenerate = async () => {
    if (!script.trim()) {
      toast.error("Please enter a script first");
      return;
    }
    if (!selectedVoice) {
      toast.error("Please select a voice");
      return;
    }
    if (!user) {
      toast.error("Please log in to generate videos");
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(0);

      // Step 1: Create the project
      console.log('Creating project...');
      const projectData = await createProject.mutateAsync({
        title: `Video ${new Date().toLocaleDateString()}`,
        script: script.trim(),
        voice_type: selectedVoice.includes('female') || selectedVoice === "9BWtsMINqrJLrRacOk9x" || selectedVoice === "EXAVITQu4vr4xnSDxMaL" ? 'female' : 'male',
        avatar_id: selectedAvatar === 'default' ? null : selectedAvatar,
        user_id: user.id,
        status: 'draft'
      });

      console.log('Project created:', projectData);
      setGenerationProgress(10);

      // Step 2: Generate the video with selected provider
      console.log('Starting video generation with provider:', videoProvider);
      await generateVideo.mutateAsync({
        projectId: projectData.id,
        script: script.trim(),
        voiceId: selectedVoice,
        avatarId: selectedAvatar,
        videoProvider
      });

      // Progress will be updated by the backend
      toast.success("Video generated successfully!");
      navigate('/dashboard');

    } catch (error) {
      console.error('Generation error:', error);
      toast.error("Failed to generate video. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleVoicePreview = async (voiceId: string) => {
    if (!script.trim()) {
      toast.error("Please enter some script text to preview the voice");
      return;
    }

    if (isPlaying && currentlyPlayingVoice === voiceId) {
      stopPreview();
    } else {
      await playVoicePreview(voiceId, script);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="w-5 h-5 text-purple-600" />
                <span>Script & Voice</span>
              </CardTitle>
              <CardDescription>
                Enter your script and choose a voice for your avatar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Script</label>
                <Textarea
                  placeholder="Enter your script here... (max 5000 characters)"
                  value={script}
                  onChange={(e) => handleScriptChange(e.target.value)}
                  className="min-h-32 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-500">
                    {script.length}/{maxCharacters} characters
                  </span>
                  <Badge variant={script.length > maxCharacters * 0.8 ? "destructive" : "secondary"}>
                    {script.length > maxCharacters * 0.8 ? "Almost at limit" : "Good"}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Voice Selection</label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex items-center space-x-2">
                          <Volume2 className="w-4 h-4" />
                          <span>{voice.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {voice.gender}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {voice.accent}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedVoice && script && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Play className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Preview Audio</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-blue-600 border-blue-200 hover:bg-blue-100"
                    onClick={() => handleVoicePreview(selectedVoice)}
                    disabled={isPlaying && currentlyPlayingVoice !== selectedVoice}
                  >
                    {isPlaying && currentlyPlayingVoice === selectedVoice ? (
                      <>
                        <Pause className="w-3 h-3 mr-1" />
                        Stop Preview
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Play Preview
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-purple-600" />
                <span>Choose Avatar & Video Provider</span>
              </CardTitle>
              <CardDescription>
                Select an avatar and video generation provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Video Provider Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Video Generation Provider</label>
                <div className="grid md:grid-cols-2 gap-3">
                  {videoProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        videoProvider === provider.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      onClick={() => setVideoProvider(provider.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <Zap className="w-5 h-5 text-purple-600" />
                          <div>
                            <h3 className="font-medium">{provider.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {provider.description}
                            </p>
                          </div>
                        </div>
                        <Badge variant={provider.badgeVariant} className="text-xs">
                          {provider.badge}
                        </Badge>
                      </div>
                      {videoProvider === provider.id && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {videoProvider === 'sadtalker' && (
                  <div className="p-4 bg-green-50 rounded-lg mt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Zap className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">SadTalker Benefits</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Open-source solution with more natural facial expressions and lip-sync. Cost-effective for high-volume usage.
                    </p>
                  </div>
                )}
              </div>

              {/* Avatar Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Avatar Selection</label>
                <div className="grid md:grid-cols-2 gap-4">
                  {avatars.map((avatar) => (
                    <div
                      key={avatar.id}
                      className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedAvatar === avatar.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      onClick={() => setSelectedAvatar(avatar.id)}
                    >
                      <div className="flex flex-col items-center text-center">
                        {avatar.preview ? (
                          <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-3">
                            <User className="w-12 h-12 text-purple-600" />
                          </div>
                        ) : (
                          <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center mb-3">
                            <Upload className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <h3 className="font-medium">{avatar.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {avatar.description}
                        </p>
                      </div>
                      {selectedAvatar === avatar.id && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedAvatar === "custom" && (
                <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Upload your avatar image</p>
                  <p className="text-xs text-gray-500 mb-3">Best results with clear face photos (JPG/PNG)</p>
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                <span>Generate Talking Video</span>
              </CardTitle>
              <CardDescription>
                Review your settings and generate your AI talking avatar video
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Script Preview</h4>
                  <p className="text-sm text-gray-600 italic">"{script}"</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>{script.length} characters</span>
                    <span>≈ {Math.ceil(script.length / 200)} seconds</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Voice</h4>
                    <div className="flex items-center space-x-2">
                      <Volume2 className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">
                        {voices.find(v => v.id === selectedVoice)?.name}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Avatar</h4>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">
                        {avatars.find(a => a.id === selectedAvatar)?.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Wand2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">AI Video Generation</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Your video will feature realistic lip-syncing and natural avatar movements synchronized with the generated speech.
                  </p>
                </div>
              </div>

              {isGenerating && (
                <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">Generating your talking video with {videoProviders.find(p => p.id === videoProvider)?.name}...</span>
                  </div>
                  <Progress value={generationProgress} className="mb-2" />
                  <p className="text-sm text-gray-600">
                    This process includes speech generation, avatar animation, and lip-syncing. This usually takes 2-5 minutes.
                  </p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !script || !selectedVoice || !user}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg py-3"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generating Talking Video...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Talking Video
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => step > 1 ? setStep(step - 1) : navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step > 1 ? 'Back' : 'Dashboard'}
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Create Talking Video
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4 mb-4">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= stepNumber
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      step > stepNumber ? "bg-purple-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-1">
              {step === 1 && "Script & Voice"}
              {step === 2 && "Avatar & Provider"}
              {step === 3 && "Generate Talking Video"}
            </h2>
            <p className="text-gray-600">
              Step {step} of 3
            </p>
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-2xl mx-auto">
          {renderStepContent()}

          {/* Navigation Buttons */}
          {step < 3 && !isGenerating && (
            <div className="flex justify-end mt-6">
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && (!script || !selectedVoice)) ||
                  (step === 2 && (!selectedAvatar || !videoProvider))
                }
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Create;
