import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export type LocalAssetRole =
  | "concept"
  | "view_front"
  | "view_left"
  | "view_back"
  | "view_right"
  | "geometry_glb";

export interface LocalAsset {
  id: string;
  role: LocalAssetRole;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  provider: string;
  model: string;
  externalId?: string | null;
  createdAt: string;
}

export interface LocalJob {
  id: string;
  kind: "geometry";
  provider: "meshy";
  externalId: string;
  route: "image-to-3d" | "multi-image-to-3d";
  status: string;
  createdAt: string;
  updatedAt: string;
  outputAssetId?: string;
}

export interface LocalProject {
  format: "com.crafthinkera.local-project/v1";
  id: string;
  title?: string;
  intent: string;
  createdAt: string;
  updatedAt: string;
  assets: LocalAsset[];
  jobs: LocalJob[];
}

const PROJECT_ID = /^local_[0-9a-f-]{36}$/;

function validateProjectId(id: string): void {
  if (!PROJECT_ID.test(id)) throw new Error("invalid_local_project_id");
}

function projectDir(stateDir: string, id: string): string {
  validateProjectId(id);
  return join(stateDir, "projects", id);
}

function manifestPath(stateDir: string, id: string): string {
  return join(projectDir(stateDir, id), "project.json");
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, path);
}

export async function createLocalProject(input: {
  stateDir: string;
  intent: string;
  title?: string;
}): Promise<LocalProject> {
  const id = `local_${randomUUID()}`;
  const now = new Date().toISOString();
  const project: LocalProject = {
    format: "com.crafthinkera.local-project/v1",
    id,
    title: input.title,
    intent: input.intent,
    createdAt: now,
    updatedAt: now,
    assets: [],
    jobs: [],
  };
  const dir = projectDir(input.stateDir, id);
  await mkdir(join(dir, "assets"), { recursive: true, mode: 0o700 });
  await atomicJson(manifestPath(input.stateDir, id), project);
  return project;
}

export async function readLocalProject(stateDir: string, id: string): Promise<LocalProject> {
  const raw = await readFile(manifestPath(stateDir, id), "utf8");
  const project = JSON.parse(raw) as LocalProject;
  if (project.id !== id || project.format !== "com.crafthinkera.local-project/v1") {
    throw new Error("invalid_local_project_manifest");
  }
  return project;
}

export async function writeLocalProject(stateDir: string, project: LocalProject): Promise<void> {
  validateProjectId(project.id);
  project.updatedAt = new Date().toISOString();
  await atomicJson(manifestPath(stateDir, project.id), project);
}

function extensionFor(contentType: string, role: LocalAssetRole): string {
  if (role === "geometry_glb") return "glb";
  if (contentType === "image/jpeg") return "jpg";
  return "png";
}

export async function storeLocalAsset(input: {
  stateDir: string;
  project: LocalProject;
  role: LocalAssetRole;
  bytes: Buffer;
  contentType: string;
  provider: string;
  model: string;
  externalId?: string | null;
}): Promise<LocalAsset> {
  const assetId = randomUUID();
  const ext = extensionFor(input.contentType, input.role);
  const fileName = `${input.role}-${assetId}.${ext}`;
  const path = join(projectDir(input.stateDir, input.project.id), "assets", fileName);
  await writeFile(path, input.bytes, { mode: 0o600 });
  const info = await stat(path);
  const asset: LocalAsset = {
    id: assetId,
    role: input.role,
    fileName,
    contentType: input.contentType,
    byteSize: info.size,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    provider: input.provider,
    model: input.model,
    externalId: input.externalId,
    createdAt: new Date().toISOString(),
  };
  input.project.assets.push(asset);
  await writeLocalProject(input.stateDir, input.project);
  return asset;
}

export async function readAssetBytes(
  stateDir: string,
  project: LocalProject,
  asset: LocalAsset,
): Promise<Buffer> {
  // fileName is generated internally, but basename is a final defense against a
  // hand-edited manifest turning asset reads into arbitrary filesystem reads.
  if (basename(asset.fileName) !== asset.fileName) throw new Error("invalid_asset_filename");
  return readFile(join(projectDir(stateDir, project.id), "assets", asset.fileName));
}

export function latestAsset(project: LocalProject, role: LocalAssetRole): LocalAsset | undefined {
  return [...project.assets].reverse().find((asset) => asset.role === role);
}

export function publicProject(project: LocalProject) {
  return {
    ...project,
    assets: project.assets.map((asset) => ({ ...asset })),
  };
}
