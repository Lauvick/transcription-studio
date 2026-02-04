import { NextRequest, NextResponse } from "next/server";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload";

export async function POST(request: NextRequest) {
  if (!ASSEMBLYAI_API_KEY) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY non configurée" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResponse = await fetch(ASSEMBLYAI_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("AssemblyAI upload error:", errorText);
      
      if (uploadResponse.status === 401 || uploadResponse.status === 403) {
        return NextResponse.json(
          { error: "Clé API AssemblyAI invalide ou expirée" },
          { status: uploadResponse.status }
        );
      }

      return NextResponse.json(
        { error: `Erreur upload AssemblyAI: ${uploadResponse.status}` },
        { status: uploadResponse.status }
      );
    }

    const data = await uploadResponse.json();
    return NextResponse.json({ upload_url: data.upload_url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

