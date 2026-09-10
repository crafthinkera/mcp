import { providerErrorCode, providerHttpError } from "./provider-error.js";

const BASE = "https://api.meshy.ai/openapi/v1";
const MAX_IMAGES = 4;
const MAX_GLB_BYTES = 300 * 1024 * 1024;

export interface MeshyTaskState {
  taskId: string;
  route: "image-to-3d" | "multi-image-to-3d";
}

export interface MeshyTaskResult {
  status: string;
  progress?: number;
  error?: string;
  glbUrl?: string;
  consumedCredits?: number;
}

function toDataUri(bytes: Buffer, contentType: string): string {
  const safeType = /^image\/(png|jpeg|jpg)$/i.test(contentType)
    ? contentType.replace("image/jpg", "image/jpeg")
    : "image/png";
  return `data:${safeType};base64,${bytes.toString("base64")}`;
}

export async function createMeshyTask(input: {
  apiKey: string;
  model: string;
  images: Array<{ bytes: Buffer; contentType: string }>;
  textured?: boolean;
}): Promise<MeshyTaskState> {
  if (!input.images.length) throw new Error("meshy_missing_image");
  const imageUrls = input.images.slice(0, MAX_IMAGES).map((image) =>
    toDataUri(image.bytes, image.contentType),
  );
  const multi = imageUrls.length > 1;
  const route = multi ? "multi-image-to-3d" : "image-to-3d";
  const common = {
    ai_model: input.model,
    should_texture: input.textured ?? true,
    target_formats: ["glb"],
    should_remesh: false,
    image_enhancement: false,
  };
  const body = multi
    ? { ...common, image_urls: imageUrls }
    : { ...common, image_url: imageUrls[0] };

  const response = await fetch(`${BASE}/${route}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw providerHttpError({
      provider: "meshy",
      operation: "create",
      status: response.status,
      detail,
    });
  }
  const json = (await response.json()) as { result?: string };
  if (!json.result) throw new Error("meshy_missing_task_id");
  return { taskId: json.result, route };
}

export async function getMeshyTask(input: {
  apiKey: string;
  taskId: string;
  route: MeshyTaskState["route"];
}): Promise<MeshyTaskResult> {
  const response = await fetch(`${BASE}/${input.route}/${input.taskId}`, {
    headers: { Authorization: `Bearer ${input.apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`meshy_get_failed:${response.status}`);
  }
  const raw = (await response.json()) as Record<string, unknown>;
  const urls = (raw.model_urls ?? {}) as Record<string, string>;
  return {
    status: String(raw.status ?? "PENDING"),
    progress: typeof raw.progress === "number" ? raw.progress : undefined,
    error:
      typeof (raw.task_error as { message?: string } | undefined)?.message === "string"
        ? providerErrorCode((raw.task_error as { message: string }).message)
        : undefined,
    glbUrl: typeof urls.glb === "string" ? urls.glb : undefined,
    consumedCredits:
      typeof raw.consumed_credits === "number" ? raw.consumed_credits : undefined,
  };
}

export async function downloadMeshyGlb(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("meshy_output_url_not_https");
  // Output URLs are accepted only from Meshy's own asset hosts. Do not turn this
  // helper into a generic authenticated downloader / SSRF primitive.
  if (!(parsed.hostname === "meshy.ai" || parsed.hostname.endsWith(".meshy.ai"))) {
    throw new Error("meshy_output_host_not_allowed");
  }
  const response = await fetch(parsed, { redirect: "follow" });
  if (!response.ok) throw new Error(`meshy_download_failed:${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_GLB_BYTES) throw new Error("meshy_output_too_large");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_GLB_BYTES) throw new Error("meshy_output_too_large");
  return bytes;
}
