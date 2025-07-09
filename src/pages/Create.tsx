
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Mic, Volume2, Wand2, FileText, User, Megaphone, BookOpen, HeadphonesIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateProject, useGenerateAudio } from "@/hooks/useProjects";

const Create = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedIntent, setSelectedIntent] = useState("");
  const [text, setText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const createProject = useCreateProject();
  const generateAudio = useGenerateAudio();

  const maxCharacters = 5000;
  
  // Voice intent options with descriptions and icons
  const voiceIntents = [
    { 
      id: "normal", 
      name: "Normal", 
      description: "Default voice, balanced tone for general content",
      icon: Volume2,
      color: "bg-blue-50 border-blue-200 text-blue-700"
    },
    { 
      id: "vlog", 
      name: "Vlog", 
      description: "Energetic, conversational, expressive for vlogs",
      icon: User,
      color: "bg-orange-50 border-orange-200 text-orange-700"
    },
    { 
      id: "pdf", 
      name: "PDF", 
      description: "Neutral, professional tone for document reading",
      icon: FileText,
      color: "bg-green-50 border-green-200 text-green-700"
    },
    { 
      id: "announcer", 
      name: "Announcer", 
      description: "Bold, impactful, attention-grabbing voice",
      icon: Megaphone,
      color: "bg-red-50 border-red-200 text-red-700"
    },
    { 
      id: "narrator", 
      name: "Narrator", 
      description: "Immersive, dramatic voice for storytelling",
      icon: BookOpen,
      color: "bg-purple-50 border-purple-200 text-purple-700"
    },
    { 
      id: "assistant", 
      name: "Assistant", 
      description: "Supportive, clear, instructive voice",
      icon: HeadphonesIcon,
      color: "bg-teal-50 border-teal-200 text-teal-700"
    }
  ];

  const handleTextChange = (value: string) => {
    if (value.length <= maxCharacters) {
      setText(value);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      // In a real implementation, you'd extract text from the PDF here
      toast.success('PDF uploaded successfully! Text extraction feature coming soon.');
    } else {
      toast.error('Please upload a valid PDF file');
    }
  };

  const handleGenerate = async () => {
    const contentText = selectedIntent === 'pdf' && uploadedFile ? 
      'PDF text extraction will be implemented here' : 
      text.trim();

    if (!contentText) {
      toast.error("Please enter text or upload a PDF");
      return;
    }
    if (!selectedIntent) {
      toast.error("Please select a voice intent");
      return;
    }
    if (!user) {
      toast.error("Please log in to generate audio");
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(0);

      // Step 1: Create the project
      console.log('Creating project...');
      const projectData = await createProject.mutateAsync({
        title: `Audio ${voiceIntents.find(i => i.id === selectedIntent)?.name} ${new Date().toLocaleDateString()}`,
        script: contentText,
        voice_type: 'custom',
        user_id: user.id,
        status: 'draft'
      });

      console.log('Project created:', projectData);
      setGenerationProgress(10);

      // Step 2: Generate the audio with Replicate Kokoro TTS
      console.log('Starting audio generation with voice style:', selectedIntent);
      await generateAudio.mutateAsync({
        projectId: projectData.id,
        text: contentText,
        voiceStyle: selectedIntent
      });

      toast.success("Audio generated successfully with Kokoro TTS!");
      navigate('/dashboard');

    } catch (error) {
      console.error('Generation error:', error);
      toast.error("Failed to generate audio. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
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
                <span>Choose Voice Intent</span>
              </CardTitle>
              <CardDescription>
                Select the style and tone that best fits your content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {voiceIntents.map((intent) => {
                  const IconComponent = intent.icon;
                  return (
                    <div
                      key={intent.id}
                      className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedIntent === intent.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      onClick={() => setSelectedIntent(intent.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${intent.color}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{intent.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {intent.description}
                          </p>
                        </div>
                      </div>
                      {selectedIntent === intent.id && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span>Content Input</span>
              </CardTitle>
              <CardDescription>
                {selectedIntent === 'pdf' 
                  ? 'Upload a PDF document to convert to audio'
                  : 'Enter the text you want to convert to audio'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedIntent === 'pdf' ? (
                <div className="space-y-4">
                  <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload your PDF document</p>
                    <p className="text-xs text-gray-500 mb-3">We'll extract the text and convert it to audio</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <Button asChild variant="outline" size="sm">
                      <label htmlFor="pdf-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Choose PDF File
                      </label>
                    </Button>
                  </div>
                  {uploadedFile && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✓ {uploadedFile.name} uploaded successfully
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">Text Content</label>
                  <Textarea
                    placeholder="Enter your text here... (max 5000 characters)"
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className="min-h-32 resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-500">
                      {text.length}/{maxCharacters} characters
                    </span>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Volume2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    Selected Voice: {voiceIntents.find(i => i.id === selectedIntent)?.name}
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  {voiceIntents.find(i => i.id === selectedIntent)?.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5 text-purple-600" />
                <span>Generate Audio</span>
              </CardTitle>
              <CardDescription>
                Review your settings and generate your AI audio with Kokoro TTS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Content Preview</h4>
                  <p className="text-sm text-gray-600 italic">
                    {selectedIntent === 'pdf' && uploadedFile 
                      ? `"PDF: ${uploadedFile.name}"`
                      : `"${text}"`
                    }
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>
                      {selectedIntent === 'pdf' && uploadedFile 
                        ? 'PDF document'
                        : `${text.length} characters`
                      }
                    </span>
                    <span>≈ {Math.ceil((text.length || 500) / 200)} seconds</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Voice Style</h4>
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-purple-600" />
                    <span className="text-sm">
                      {voiceIntents.find(v => v.id === selectedIntent)?.name} - {voiceIntents.find(v => v.id === selectedIntent)?.description}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Wand2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">AI Audio Generation with Kokoro TTS</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Your audio will be generated using the latest Kokoro TTS model via Replicate API, providing natural and expressive speech synthesis.
                  </p>
                </div>
              </div>

              {isGenerating && (
                <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">Generating your audio with Kokoro TTS...</span>
                  </div>
                  <Progress value={generationProgress} className="mb-2" />
                  <p className="text-sm text-gray-600">
                    This process includes text processing and neural voice synthesis. This usually takes 1-3 minutes.
                  </p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || (!text && !uploadedFile) || !selectedIntent || !user}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg py-3"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generating Audio with Kokoro TTS...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Audio (Kokoro TTS)
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
                <Volume2 className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Create Audio
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
              {step === 1 && "Voice Intent"}
              {step === 2 && "Content Input"}
              {step === 3 && "Generate Audio"}
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
                  (step === 1 && !selectedIntent) ||
                  (step === 2 && !text && (!uploadedFile || selectedIntent !== 'pdf'))
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
