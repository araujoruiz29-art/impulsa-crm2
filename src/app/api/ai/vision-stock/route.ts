import { NextRequest, NextResponse } from "next/server";
import { identifyShoeAndFetchLiveStock } from "@/lib/vision-stock";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let imageBytes: Buffer | undefined;
    let mimeType = "image/jpeg";
    let hintText = "";
    let candidateUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      hintText = String(formData.get("hint") || "").trim();
      candidateUrl = String(formData.get("candidateUrl") || "").trim();
      if (file && file.size > 0) {
        imageBytes = Buffer.from(await file.arrayBuffer());
        mimeType = file.type || "image/jpeg";
      }
    } else {
      const body = await req.json();
      hintText = String(body.hint || body.query || "").trim();
      candidateUrl = String(body.candidateUrl || "").trim();
      if (body.imageUrl) {
        const imgRes = await fetch(String(body.imageUrl));
        if (imgRes.ok) {
          imageBytes = Buffer.from(await imgRes.arrayBuffer());
          mimeType = imgRes.headers.get("content-type") || "image/jpeg";
        }
      }
    }

    if (!imageBytes && !hintText) {
      return NextResponse.json(
        { error: "Sube una foto de zapato o escribe un modelo/referencia para consultar stock en vivo." },
        { status: 400 }
      );
    }

    const result = await identifyShoeAndFetchLiveStock({
      imageBytes,
      mimeType,
      hintText,
      candidateUrl: candidateUrl || undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Vision stock error:", err);
    return NextResponse.json(
      { error: "Error consultando reconocimiento visual y stock en tienda." },
      { status: 500 }
    );
  }
}
