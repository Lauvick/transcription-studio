"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Server, Monitor } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5005";

interface BackendInfo {
  status: string;
  server: string;
  port: number;
  timestamp: string;
  uptime: number;
  history: {
    count: number;
    maxItems: number;
  };
  apiKey: {
    configured: boolean;
    masked: string | null;
  };
  environment: {
    nodeVersion: string;
    platform: string;
  };
}

export default function InfosPage() {
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null);
  const [frontendStatus, setFrontendStatus] = useState<"checking" | "ok" | "error">("checking");
  const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "error">("checking");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    setBackendStatus("checking");
    setFrontendStatus("checking");

    // Vérifier le frontend
    setFrontendStatus("ok");

    // Vérifier le backend
    try {
      const response = await fetch(`${API_URL}/api/infos`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setBackendInfo(data);
        setBackendStatus("ok");
      } else {
        setBackendStatus("error");
        setError(`Backend responded with status ${response.status}`);
      }
    } catch (err: any) {
      setBackendStatus("error");
      setError(err.message || "Impossible de se connecter au backend");
      console.error("Error fetching backend info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Informations système
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Vérification de l'état des serveurs frontend et backend
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <Button onClick={checkStatus} disabled={loading} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frontend Status */}
          <Card className="border-2 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500 text-white">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <CardTitle>Frontend</CardTitle>
                </div>
                {frontendStatus === "ok" ? (
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Opérationnel
                  </Badge>
                ) : frontendStatus === "error" ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Erreur
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Vérification...
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Serveur:</span>
                <span className="text-sm font-medium">Next.js</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Port:</span>
                <span className="text-sm font-medium">3005</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">URL:</span>
                <span className="text-sm font-mono">http://localhost:3005</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  ✅ En ligne
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Backend Status */}
          <Card className="border-2 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500 text-white">
                    <Server className="h-5 w-5" />
                  </div>
                  <CardTitle>Backend</CardTitle>
                </div>
                {backendStatus === "ok" ? (
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Opérationnel
                  </Badge>
                ) : backendStatus === "error" ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Erreur
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Vérification...
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-2">
              {backendInfo ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Serveur:</span>
                    <span className="text-sm font-medium">{backendInfo.server}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Port:</span>
                    <span className="text-sm font-medium">{backendInfo.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">URL:</span>
                    <span className="text-sm font-mono">http://localhost:{backendInfo.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Uptime:</span>
                    <span className="text-sm font-medium">
                      {formatUptime(backendInfo.uptime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Node.js:</span>
                    <span className="text-sm font-medium">{backendInfo.environment.nodeVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Platform:</span>
                    <span className="text-sm font-medium">{backendInfo.environment.platform}</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  ) : (
                    <p className="text-sm text-destructive">{error || "Impossible de charger les informations"}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Backend Details */}
        {backendInfo && (
          <div className="mt-6 space-y-6">
            <Card className="border-2 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
                <CardTitle>Détails du backend</CardTitle>
                <CardDescription>Informations détaillées sur le serveur backend</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Historique</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Éléments:</span>
                      <span className="font-medium">
                        {backendInfo.history.count} / {backendInfo.history.maxItems}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Clé API AssemblyAI</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Configurée:</span>
                      <Badge variant={backendInfo.apiKey.configured ? "default" : "secondary"}>
                        {backendInfo.apiKey.configured ? "✅ Oui" : "❌ Non"}
                      </Badge>
                    </div>
                    {backendInfo.apiKey.masked && (
                      <div className="text-xs font-mono text-muted-foreground mt-1">
                        {backendInfo.apiKey.masked}
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2">Timestamp</h4>
                  <p className="text-xs font-mono text-muted-foreground">
                    {new Date(backendInfo.timestamp).toLocaleString("fr-FR")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Connection Test */}
            <Card className="border-2 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 rounded-t-lg border-b">
                <CardTitle>Test de connexion</CardTitle>
                <CardDescription>Vérification de la communication frontend ↔ backend</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">Frontend</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                  {backendStatus === "ok" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : backendStatus === "error" ? (
                    <XCircle className="h-6 w-6 text-red-500" />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  )}
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-indigo-500" />
                    <span className="text-sm font-medium">Backend</span>
                  </div>
                </div>
                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

