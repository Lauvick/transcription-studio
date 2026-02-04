"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, Upload, Trash2, X, Key, FileAudio, Mic, Languages, Settings2, CheckCircle2, Loader2, AlertCircle, Link2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HistoryItem } from "@/lib/history";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005";

type TranscriptStatus = "queued" | "processing" | "completed" | "error";

interface TranscriptState {
  id: string | null;
  status: TranscriptStatus;
  text: string;
  error: string | null;
}

export default function TranscriptionStudio() {
  const [languageMode, setLanguageMode] = useState<"single" | "bilingual">("single");
  const [singleLanguage, setSingleLanguage] = useState<"fr" | "en">("fr");
  const [bilingual, setBilingual] = useState(false);
  const [speakerLabels, setSpeakerLabels] = useState(false);
  const [punctuate, setPunctuate] = useState(true);
  
  const [inputMode, setInputMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [transcriptState, setTranscriptState] = useState<TranscriptState>({
    id: null,
    status: "queued",
    text: "",
    error: null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [apiKeyMasked, setApiKeyMasked] = useState<string>("");
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string>("");

  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
    loadApiKey();
  }, []);

  useEffect(() => {
    if (bilingual) {
      setLanguageMode("bilingual");
    } else {
      setLanguageMode("single");
    }
  }, [bilingual]);

  useEffect(() => {
    if (transcriptState.id && transcriptState.status !== "completed" && transcriptState.status !== "error") {
      startPolling(transcriptState.id);
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [transcriptState.id, transcriptState.status]);

  const loadHistory = async () => {
    try {
      console.log("Loading history from:", `${API_URL}/api/history`);
      const response = await fetch(`${API_URL}/api/history`);
      console.log("History response status:", response.status, "ok:", response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log("History loaded:", data.length, "items", data);
        setHistory(data);
      } else {
        const errorText = await response.text();
        console.error("Error loading history - Status:", response.status, "Response:", errorText);
        try {
          const error = JSON.parse(errorText);
          console.error("Parsed error:", error);
        } catch {
          console.error("Could not parse error as JSON");
        }
      }
    } catch (error: any) {
      console.error("Error loading history (catch):", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
  };

  const loadApiKey = async () => {
    try {
      const response = await fetch(`${API_URL}/api/config/api-key`);
      if (response.ok) {
        const data = await response.json();
        setApiKeyMasked(data.apiKey || "");
        setIsApiKeyConfigured(data.configured || false);
      }
    } catch (error) {
      console.error("Error loading API key:", error);
    }
  };

  const saveApiKey = async () => {
    if (!newApiKey.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une clé API",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/config/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: newApiKey.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Clé API mise à jour",
          description: "La clé API a été sauvegardée avec succès",
        });
        setNewApiKey("");
        setIsApiKeyDialogOpen(false);
        await loadApiKey();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la sauvegarde");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la clé API",
        variant: "destructive",
      });
    }
  };

  const startPolling = (transcriptId: string) => {
    stopPolling();
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/assemblyai/transcripts/${transcriptId}`);
        if (!response.ok) throw new Error("Erreur lors de la récupération");

        const data = await response.json();
        
        setTranscriptState({
          id: transcriptId,
          status: data.status,
          text: data.text || "",
          error: data.error || null,
        });

        if (data.status === "completed") {
          stopPolling();
          
          // Sauvegarder dans l'historique AVANT d'afficher le toast
          const textToSave = data.text || "";
          if (textToSave.trim()) {
            console.log("Transcription completed, saving to history...");
            await saveToHistory({
              type: "transcription",
              text: textToSave,
              language: singleLanguage,
              languageCodes: bilingual ? ["en", "fr"] : undefined,
              metadata: {
                filename: inputMode === "file" ? file?.name : (inputMode === "url" ? audioUrl : undefined),
                speakerLabels,
                punctuate,
              },
            });
          } else {
            console.warn("Transcription completed but text is empty, not saving to history");
          }
          
          toast({
            title: "Transcription terminée",
            description: "Votre transcription est prête.",
          });
        } else if (data.status === "error") {
          stopPolling();
          toast({
            title: "Erreur de transcription",
            description: data.error || "Une erreur est survenue",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error("Polling error:", error);
        stopPolling();
        toast({
          title: "Erreur",
          description: error.message || "Erreur lors du polling",
          variant: "destructive",
        });
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const startTranscription = async (audioUrlToUse: string, sourceName: string) => {
    if (languageMode === "single" && !singleLanguage) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une langue",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setTranscriptState({ id: null, status: "queued", text: "", error: null });

    try {
      const transcriptPayload: any = {
        audio_url: audioUrlToUse,
        speaker_labels: speakerLabels,
        punctuate: punctuate,
      };

      if (bilingual) {
        transcriptPayload.language_codes = ["en", "fr"];
      } else {
        transcriptPayload.language_code = singleLanguage;
      }

      const transcriptResponse = await fetch(`${API_URL}/api/assemblyai/transcripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transcriptPayload),
      });

      if (!transcriptResponse.ok) {
        const error = await transcriptResponse.json();
        throw new Error(error.error || "Erreur lors de la création de la transcription");
      }

      const transcriptData = await transcriptResponse.json();
      setTranscriptState({
        id: transcriptData.id,
        status: transcriptData.status,
        text: "",
        error: null,
      });

      toast({
        title: "Transcription démarrée",
        description: "Votre fichier est en cours de traitement...",
      });
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
      setTranscriptState({
        id: null,
        status: "error",
        text: "",
        error: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setTranscriptState({ id: null, status: "queued", text: "", error: null });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(`${API_URL}/api/assemblyai/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Erreur lors de l'upload");
      }

      const { upload_url } = await uploadResponse.json();
      await startTranscription(upload_url, file.name);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
      setTranscriptState({
        id: null,
        status: "error",
        text: "",
        error: error.message,
      });
      setIsUploading(false);
    }
  };

  const convertGoogleDriveUrl = (url: string): string => {
    // Convertir les URLs Google Drive en liens directs téléchargeables
    // Format: https://drive.google.com/file/d/FILE_ID/view
    // Vers: https://drive.google.com/uc?export=download&id=FILE_ID
    
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);
    
    if (match && match[1]) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    
    // Si c'est déjà un lien direct, le retourner tel quel
    return url;
  };

  const handleUrlTranscription = async () => {
    if (!audioUrl.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une URL",
        variant: "destructive",
      });
      return;
    }

    // Validation basique de l'URL
    let finalUrl = audioUrl.trim();
    try {
      new URL(finalUrl);
    } catch {
      toast({
        title: "Erreur",
        description: "URL invalide",
        variant: "destructive",
      });
      return;
    }

    // Convertir les URLs Google Drive en liens directs
    if (finalUrl.includes("drive.google.com")) {
      const convertedUrl = convertGoogleDriveUrl(finalUrl);
      if (convertedUrl !== finalUrl) {
        toast({
          title: "URL Google Drive détectée",
          description: "Conversion en lien direct...",
        });
        finalUrl = convertedUrl;
      }
    }

    await startTranscription(finalUrl, audioUrl.trim());
  };

  const saveToHistory = async (item: Omit<HistoryItem, "id" | "createdAt">) => {
    try {
      console.log("=== SAVE TO HISTORY START ===");
      console.log("Saving to history:", {
        type: item.type,
        textLength: item.text?.length,
        language: item.language,
        metadata: item.metadata,
      });
      console.log("API_URL:", API_URL);
      console.log("Request URL:", `${API_URL}/api/history`);
      
      const requestBody = JSON.stringify(item);
      console.log("Request body length:", requestBody.length, "bytes");
      
      const response = await fetch(`${API_URL}/api/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const savedItem = await response.json();
        console.log("✅ Saved successfully:", {
          id: savedItem.id,
          type: savedItem.type,
          createdAt: savedItem.createdAt,
        });
        
        // Attendre un peu pour que le fichier soit bien écrit
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Recharger l'historique
        console.log("Reloading history...");
        await loadHistory();
        
        toast({
          title: "Sauvegardé",
          description: "La transcription a été ajoutée à l'historique",
        });
        console.log("=== SAVE TO HISTORY SUCCESS ===");
      } else {
        const errorText = await response.text();
        console.error("❌ Error response status:", response.status);
        console.error("❌ Error response text:", errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        console.error("Error saving to history:", error);
        toast({
          title: "Erreur",
          description: error.error || `Erreur ${response.status}: Impossible de sauvegarder dans l'historique`,
          variant: "destructive",
        });
        console.log("=== SAVE TO HISTORY FAILED ===");
      }
    } catch (error: any) {
      console.error("❌ Error saving to history (catch):", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder dans l'historique",
        variant: "destructive",
      });
      console.log("=== SAVE TO HISTORY ERROR ===");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: "Le texte a été copié dans le presse-papiers",
    });
  };

  const exportToTxt = (text: string, filename: string = "transcription") => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Export réussi",
      description: "Le fichier a été téléchargé",
    });
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/history/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadHistory();
        toast({
          title: "Supprimé",
          description: "L'élément a été supprimé de l'historique",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'élément",
        variant: "destructive",
      });
    }
  };

  const clearHistory = async () => {
    if (!confirm("Êtes-vous sûr de vouloir effacer tout l'historique ?")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/history`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadHistory();
        toast({
          title: "Historique effacé",
          description: "Tous les éléments ont été supprimés",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'effacer l'historique",
        variant: "destructive",
      });
    }
  };

  const exportHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/history/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcriptions-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Export réussi",
          description: "L'historique a été exporté",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter l'historique",
        variant: "destructive",
      });
    }
  };

  const importHistory = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch(`${API_URL}/api/history/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        await loadHistory();
        toast({
          title: "Import réussi",
          description: "L'historique a été importé",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'import");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Format de fichier invalide",
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const getStatusBadge = (status: TranscriptStatus) => {
    const variants: Record<TranscriptStatus, "default" | "secondary" | "destructive"> = {
      queued: "secondary",
      processing: "default",
      completed: "default",
      error: "destructive",
    };

    const labels: Record<TranscriptStatus, string> = {
      queued: "En attente",
      processing: "En cours",
      completed: "Terminé",
      error: "Erreur",
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Header */}
        <div className="mb-8 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <Mic className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Transcription Studio
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 ml-12">
                Transcription audio/vidéo professionnelle avec intelligence artificielle
              </p>
            </div>
            <Button
              variant={isApiKeyConfigured ? "outline" : "default"}
              size="sm"
              onClick={() => {
                setNewApiKey("");
                setIsApiKeyDialogOpen(true);
                loadApiKey();
              }}
              className="flex items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
            >
              <Key className="h-4 w-4" />
              {isApiKeyConfigured ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Clé configurée
                </span>
              ) : (
                "Configurer la clé API"
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Language Selection Card */}
            <Card className="border-2 border-slate-200/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500 text-white">
                    <Languages className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Configuration de la langue</CardTitle>
                    <CardDescription className="mt-1">
                      Sélectionnez la langue de votre fichier audio
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <RadioGroup
                  value={languageMode}
                  onValueChange={(v) => {
                    setLanguageMode(v as "single" | "bilingual");
                    if (v === "bilingual") {
                      setBilingual(true);
                    } else {
                      setBilingual(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single" className="font-medium cursor-pointer flex-1">
                      Une seule langue
                    </Label>
                  </div>
                  {languageMode === "single" && (
                    <div className="ml-8 animate-in fade-in slide-in-from-top-2">
                      <Select
                        value={singleLanguage}
                        onValueChange={(v) => setSingleLanguage(v as "fr" | "en")}
                      >
                        <SelectTrigger className="w-48 border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fr">🇫🇷 Français (fr)</SelectItem>
                          <SelectItem value="en">🇬🇧 Anglais (en)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center space-x-3 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                    <Checkbox
                      id="bilingual"
                      checked={bilingual}
                      onCheckedChange={(checked) => {
                        setBilingual(checked as boolean);
                        if (checked) {
                          setLanguageMode("bilingual");
                        } else {
                          setLanguageMode("single");
                        }
                      }}
                    />
                    <Label htmlFor="bilingual" className="font-medium cursor-pointer flex-1">
                      Audio bilingue (FR + EN)
                    </Label>
                  </div>
                  {bilingual && (
                    <div className="ml-8 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 animate-in fade-in">
                      <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Note: AssemblyAI impose que "en" soit inclus dans language_codes
                      </p>
                    </div>
                  )}
                </RadioGroup>

                <div className="pt-4 border-t space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Options de transcription
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <Checkbox
                        id="speakerLabels"
                        checked={speakerLabels}
                        onCheckedChange={(checked) => setSpeakerLabels(checked as boolean)}
                      />
                      <Label htmlFor="speakerLabels" className="cursor-pointer flex-1">
                        Identifier les locuteurs (speaker_labels)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <Checkbox
                        id="punctuate"
                        checked={punctuate}
                        onCheckedChange={(checked) => setPunctuate(checked as boolean)}
                      />
                      <Label htmlFor="punctuate" className="cursor-pointer flex-1">
                        Ponctuer automatiquement
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Source Input Card */}
            <Card className="border-2 border-slate-200/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500 text-white">
                    <FileAudio className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Source audio/vidéo</CardTitle>
                    <CardDescription className="mt-1">
                      Uploadez un fichier ou fournissez une URL
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "file" | "url")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload fichier
                    </TabsTrigger>
                    <TabsTrigger value="url" className="flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Lien URL
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="file" className="space-y-4 mt-0">
                    <div className="relative">
                      <Input
                        type="file"
                        accept=".mp3,.wav,.m4a,.mp4,.mov"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer py-8 text-center"
                      />
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Formats supportés: mp3, wav, m4a, mp4, mov
                      </p>
                      {file && (
                        <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-2 animate-in fade-in">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">
                            {file.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleFileUpload}
                      disabled={!file || isUploading || transcriptState.status === "processing"}
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                    >
                      {isUploading || transcriptState.status === "processing" ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Traitement en cours...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Mic className="h-5 w-5" />
                          Lancer la transcription
                        </span>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="url" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="audio-url">URL de l'audio/vidéo</Label>
                      <Input
                        id="audio-url"
                        type="url"
                        placeholder="https://example.com/audio.mp3 ou https://youtube.com/watch?v=..."
                        value={audioUrl}
                        onChange={(e) => setAudioUrl(e.target.value)}
                        className="w-full border-2 font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Entrez l'URL complète d'un fichier audio/vidéo accessible publiquement
                      </p>
                      <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                          💡 Astuce pour Google Drive:
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Les URLs Google Drive sont automatiquement converties en liens directs. Assurez-vous que le fichier est partagé en mode "Toute personne disposant du lien".
                        </p>
                      </div>
                      {audioUrl && (
                        <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center gap-2 animate-in fade-in">
                          <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate">
                            {audioUrl}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleUrlTranscription}
                      disabled={!audioUrl.trim() || isUploading || transcriptState.status === "processing"}
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                    >
                      {isUploading || transcriptState.status === "processing" ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Traitement en cours...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Mic className="h-5 w-5" />
                          Lancer la transcription
                        </span>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Result Card */}
            {transcriptState.id && (
              <Card className="border-2 border-slate-200/50 dark:border-slate-700/50 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500 text-white">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-xl">Résultat de la transcription</CardTitle>
                    </div>
                    {getStatusBadge(transcriptState.status)}
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {transcriptState.status === "processing" && (
                    <div className="space-y-3">
                      <Progress value={50} className="w-full h-2" />
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Transcription en cours, veuillez patienter...
                      </p>
                    </div>
                  )}

                  {transcriptState.error && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 animate-in fade-in">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <p className="font-semibold text-destructive">Erreur:</p>
                          <p className="text-sm text-destructive/80">{transcriptState.error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {transcriptState.text && (
                    <div className="space-y-4 animate-in fade-in">
                      <Textarea
                        value={transcriptState.text}
                        readOnly
                        className="min-h-[300px] font-mono text-sm border-2 bg-slate-50 dark:bg-slate-900"
                      />
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(transcriptState.text)}
                          className="flex-1 border-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copier
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => exportToTxt(transcriptState.text, file?.name || "transcription")}
                          className="flex-1 border-2 hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export TXT
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* History Sidebar */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-slate-200/50 dark:border-slate-700/50 shadow-xl sticky top-6">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500 text-white">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Historique</CardTitle>
                      <CardDescription className="text-xs">
                        {history.length} / 5 éléments
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={exportHistory}
                      title="Exporter l'historique"
                      className="h-8 w-8"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <label>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="Importer l'historique"
                        className="h-8 w-8"
                      >
                        <span>
                          <Upload className="h-4 w-4" />
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".json"
                        onChange={importHistory}
                        className="hidden"
                      />
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearHistory}
                      title="Effacer tout l'historique"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Aucun élément dans l'historique
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="group p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all cursor-pointer bg-white dark:bg-slate-800"
                        onClick={() => {
                          setSelectedHistoryItem(item);
                          setIsHistoryDialogOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {item.type === "transcription" ? "🎵 Audio" : "📝 Texte"}
                              </Badge>
                              {item.language && (
                                <span className="text-xs text-muted-foreground">
                                  {item.language}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate mb-1">
                              {item.text.substring(0, 40)}...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }}
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedHistoryItem?.type === "transcription" ? (
                <>
                  <FileAudio className="h-5 w-5" />
                  Transcription
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5" />
                  Texte
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedHistoryItem && (
                <>
                  Créé le {new Date(selectedHistoryItem.createdAt).toLocaleString("fr-FR")}
                  {selectedHistoryItem.metadata?.filename && (
                    <> • Fichier: {selectedHistoryItem.metadata.filename}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedHistoryItem && (
            <div className="space-y-4">
              <Textarea
                value={selectedHistoryItem.text}
                readOnly
                className="min-h-[400px] font-mono text-sm border-2"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(selectedHistoryItem.text)}
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copier
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    exportToTxt(
                      selectedHistoryItem.text,
                      selectedHistoryItem.metadata?.filename || "transcription"
                    )
                  }
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export TXT
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configuration de la clé API AssemblyAI
            </DialogTitle>
            <DialogDescription>
              Entrez votre clé API AssemblyAI pour activer les fonctionnalités de transcription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isApiKeyConfigured && apiKeyMasked && (
              <div className="rounded-lg bg-muted p-4 border-2">
                <Label className="text-sm font-medium">Clé API actuelle</Label>
                <p className="text-sm font-mono text-muted-foreground mt-2 bg-slate-100 dark:bg-slate-800 p-2 rounded">
                  {apiKeyMasked}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="api-key">Nouvelle clé API</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="e9354a30a627432baa2ebaff9fa27298"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                className="font-mono border-2"
              />
              <p className="text-xs text-muted-foreground">
                Votre clé API sera stockée de manière sécurisée côté serveur.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApiKeyDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveApiKey} disabled={!newApiKey.trim()}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
