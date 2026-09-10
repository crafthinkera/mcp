const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_ATTEMPTS = 3;

export interface GeminiReference {
  bytes: Buffer;
  contentType: string;
}

export interface GeminiImageResult {
  bytes: Buffer;
  contentType: string;
  interactionId: string | null;
  attempts: number;
}

interface GeminiInteraction {
  id?: string;
  status?: string;
  output_image?: { data?: string; mime_type?: string };
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      data?: string;
      mime_type?: string;
    }>;
  }>;
}

function extractImage(raw: GeminiInteraction): { data: string; contentType: string } | null {
  if (raw.output_image?.data) {
    return {
      data: raw.output_image.data,
      contentType: raw.output_image.mime_type || "image/png",
    };
  }
  for (const step of raw.steps ?? []) {
    for (const part of step.content ?? []) {
      if (part.type === "image" && part.data) {
        return { data: part.data, contentType: part.mime_type || "image/png" };
      }
    }
  }
  return null;
}

export async function generateGeminiImage(input: {
  apiKey: string;
  model: string;
  prompt: string;
  references?: GeminiReference[];
  previousInteractionId?: string;
  imageSize?: "1K" | "2K";
  aspectRatio?: string;
}): Promise<GeminiImageResult> {
  let lastError = "gemini_image_missing_output";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const parts: Array<Record<string, string>> = [
      { type: "text", text: input.prompt },
    ];

    if (!input.previousInteractionId) {
      for (const reference of input.references ?? []) {
        parts.push({
          type: "image",
          mime_type: reference.contentType || "image/png",
          data: reference.bytes.toString("base64"),
        });
      }
    }

    const body: Record<string, unknown> = {
      model: input.model,
      input: parts,
      response_format: {
        type: "image",
        image_size: input.imageSize ?? "1K",
        ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
      },
    };
    if (input.previousInteractionId) {
      body.previous_interaction_id = input.previousInteractionId;
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": input.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`gemini_image_failed:${response.status}:${detail}`);
    }

    const raw = (await response.json()) as GeminiInteraction;
    const image = extractImage(raw);
    if (image) {
      return {
        bytes: Buffer.from(image.data, "base64"),
        contentType: image.contentType,
        interactionId: typeof raw.id === "string" ? raw.id : null,
        attempts: attempt,
      };
    }
    lastError = `gemini_image_missing_output:${raw.status ?? "unknown"}`;
  }

  throw new Error(lastError);
}

export const REFERENCE_VIEW_FRAMING = [
  ["front", "Front orthographic-like view. Camera centered at chest height."],
  ["left", "Left side view, exactly 90 degrees from the front."],
  ["back", "Back view, exactly 180 degrees from the front."],
  ["right", "Right side view, exactly 90 degrees from the front."],
] as const;

export function conceptPrompt(intent: string): string {
  return [
    "Create one clean canonical product reference image for 3D reconstruction.",
    "Show exactly one object/figure, fully visible, centered, neutral background, even studio light.",
    "No contact sheet, no multiple views, no labels, no turntable frames, no exploded view.",
    "Preserve all requested proportions and identity details. Prefer geometry-readable detail over cinematic styling.",
    "The subject:",
    intent,
  ].join("\n");
}

export function viewPrompt(intent: string, framing: string): string {
  return [
    framing,
    "Render exactly the same object/figure as the reference image and previous views.",
    "Same pose, proportions, clothing, accessories, base, materials and identity. Do not redesign anything.",
    "Show one full object only. Neutral background. No text, grid, collage, duplicate figure, inset or close-up.",
    "The subject:",
    intent,
  ].join("\n");
}
