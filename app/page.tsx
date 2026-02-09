
// ... (le début du fichier reste identique)

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

    // --- NOUVELLE LOGIQUE POUR YOUTUBE ---
    const isYoutubeUrl = finalUrl.includes("youtube.com") || finalUrl.includes("youtu.be");

    if (isYoutubeUrl) {
      try {
        setIsUploading(true);
        toast({ title: "Vidéo YouTube détectée", description: "Extraction de l'audio..." });

        const response = await fetch(`${API_URL}/api/youtube/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: finalUrl })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Impossible d'extraire l'audio de la vidéo YouTube.");
        }

        const { audioUrl: extractedAudioUrl, title } = await response.json();
        await startTranscription(extractedAudioUrl, title);

      } catch (error: any) {
        console.error("YouTube URL error:", error);
        toast({
          title: "Erreur YouTube",
          description: error.message || "Une erreur est survenue lors du traitement du lien YouTube.",
          variant: "destructive",
        });
        setIsUploading(false);
      }
    } else {
      // Logique existante pour les autres URLs (Google Drive, etc.)
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
    }
  };

// ... (le reste du fichier reste identique)
