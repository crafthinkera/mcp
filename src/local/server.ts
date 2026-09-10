import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { CrafThinkeraMcpConfig } from "../config.js";
import {
  REFERENCE_VIEW_FRAMING,
  conceptPrompt,
  generateGeminiImage,
  viewPrompt,
} from "../providers/gemini.js";
import {
  createMeshyTask,
  downloadMeshyGlb,
  getMeshyTask,
} from "../providers/meshy.js";
import {
  createLocalProject,
  latestAsset,
  publicProject,
  readAssetBytes,
  readLocalProject,
  storeLocalAsset,
  writeLocalProject,
} from "./state.js";

const VERSION = "0.3.0";

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "tool_failed";
  return { ...ok({ error: message.slice(0, 500) }), isError: true as const };
}

function requireGemini(config: CrafThinkeraMcpConfig): string {
  if (!config.geminiApiKey) throw new Error("gemini_not_configured:Set GEMINI_API_KEY");
  return config.geminiApiKey;
}

function requireMeshy(config: CrafThinkeraMcpConfig): string {
  if (!config.meshyApiKey) throw new Error("meshy_not_configured:Set MESHY_API_KEY");
  return config.meshyApiKey;
}

export function localStatus(config: CrafThinkeraMcpConfig) {
  return {
    name: "Crafty MCP",
    version: VERSION,
    mode: "local-byok",
    providers: {
      gemini: { configured: Boolean(config.geminiApiKey), model: config.imageModel },
      meshy: { configured: Boolean(config.meshyApiKey), model: config.geometryModel },
    },
    crafthinkeraNetwork: {
      configured: Boolean(config.token),
      endpoint: config.url.href,
      note: config.token
        ? "Token is configured. Use check_crafthinkera_connection to verify it."
        : "Optional until you want hosted/network operations.",
    },
    stateDir: config.stateDir,
  };
}

export async function runLocalMcp(config: CrafThinkeraMcpConfig): Promise<void> {
  const server = new McpServer({ name: "crafty-local", version: VERSION });

  server.registerTool(
    "crafty_status",
    {
      description: "Show local BYOK provider readiness without revealing API keys.",
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: {},
    },
    async () => ok(localStatus(config)),
  );

  server.registerTool(
    "start_project",
    {
      description: "Create a local physical-product project. No CrafThinkERA account or token required.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      inputSchema: {
        intent: z.string().min(8).max(4000),
        title: z.string().max(200).optional(),
      },
    },
    async (args) => {
      try {
        return ok(await createLocalProject({ stateDir: config.stateDir, intent: args.intent, title: args.title }));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "inspect_project",
    {
      description: "Read a local project, generated artifacts and provider jobs.",
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args) => {
      try {
        return ok(publicProject(await readLocalProject(config.stateDir, args.projectId)));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "generate_concept",
    {
      description: "Generate one canonical concept image with the user's Gemini API key.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args) => {
      try {
        const project = await readLocalProject(config.stateDir, args.projectId);
        const generated = await generateGeminiImage({
          apiKey: requireGemini(config),
          model: config.imageModel,
          prompt: conceptPrompt(project.intent),
          imageSize: "1K",
          aspectRatio: "1:1",
        });
        const asset = await storeLocalAsset({
          stateDir: config.stateDir,
          project,
          role: "concept",
          bytes: generated.bytes,
          contentType: generated.contentType,
          provider: "gemini",
          model: config.imageModel,
          externalId: generated.interactionId,
        });
        return ok({ projectId: project.id, asset, attempts: generated.attempts });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "generate_reference_views",
    {
      description: "Generate four separate consistent geometry views from the latest concept using the user's Gemini API key.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args) => {
      try {
        const project = await readLocalProject(config.stateDir, args.projectId);
        const concept = latestAsset(project, "concept");
        if (!concept) throw new Error("concept_required");
        const reference = await readAssetBytes(config.stateDir, project, concept);
        const apiKey = requireGemini(config);
        let previousInteractionId: string | undefined;
        const outputs = [];

        for (const [roleName, framing] of REFERENCE_VIEW_FRAMING) {
          const generated = await generateGeminiImage({
            apiKey,
            model: config.imageModel,
            prompt: viewPrompt(project.intent, framing),
            references: previousInteractionId
              ? undefined
              : [{ bytes: reference, contentType: concept.contentType }],
            previousInteractionId,
            imageSize: "1K",
            aspectRatio: "1:1",
          });
          if (generated.interactionId) previousInteractionId = generated.interactionId;
          const role = `view_${roleName}` as const;
          outputs.push(
            await storeLocalAsset({
              stateDir: config.stateDir,
              project,
              role,
              bytes: generated.bytes,
              contentType: generated.contentType,
              provider: "gemini",
              model: config.imageModel,
              externalId: generated.interactionId,
            }),
          );
        }

        return ok({
          projectId: project.id,
          assets: outputs,
          geometryInputContract: "four separate images; never a contact sheet",
        });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "generate_geometry",
    {
      description: "Start a Meshy image-to-3D task from the latest separate reference views using the user's Meshy API key.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: { projectId: z.string().min(1), textured: z.boolean().default(true) },
    },
    async (args) => {
      try {
        const project = await readLocalProject(config.stateDir, args.projectId);
        const roles = ["view_front", "view_left", "view_back", "view_right"] as const;
        const viewAssets = roles.map((role) => latestAsset(project, role)).filter(Boolean);
        if (viewAssets.length < 2) throw new Error("reference_views_required:need_at_least_2");
        const images = [];
        for (const asset of viewAssets) {
          images.push({
            bytes: await readAssetBytes(config.stateDir, project, asset!),
            contentType: asset!.contentType,
          });
        }
        const task = await createMeshyTask({
          apiKey: requireMeshy(config),
          model: config.geometryModel,
          images,
          textured: args.textured,
        });
        const now = new Date().toISOString();
        const job = {
          id: `meshy_${task.taskId}`,
          kind: "geometry" as const,
          provider: "meshy" as const,
          externalId: task.taskId,
          route: task.route,
          status: "PENDING",
          createdAt: now,
          updatedAt: now,
        };
        project.jobs.push(job);
        await writeLocalProject(config.stateDir, project);
        return ok({ projectId: project.id, job, next: "Call check_geometry with this jobId." });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "check_geometry",
    {
      description: "Check a Meshy task once. When it succeeds, download the GLB into the local project.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { projectId: z.string().min(1), jobId: z.string().min(1) },
    },
    async (args) => {
      try {
        const project = await readLocalProject(config.stateDir, args.projectId);
        const job = project.jobs.find((entry) => entry.id === args.jobId && entry.kind === "geometry");
        if (!job) throw new Error("geometry_job_not_found");
        const result = await getMeshyTask({
          apiKey: requireMeshy(config),
          taskId: job.externalId,
          route: job.route,
        });
        job.status = result.status;
        job.updatedAt = new Date().toISOString();

        let asset = job.outputAssetId
          ? project.assets.find((entry) => entry.id === job.outputAssetId)
          : undefined;
        if (result.status === "SUCCEEDED" && result.glbUrl && !asset) {
          const bytes = await downloadMeshyGlb(result.glbUrl);
          asset = await storeLocalAsset({
            stateDir: config.stateDir,
            project,
            role: "geometry_glb",
            bytes,
            contentType: "model/gltf-binary",
            provider: "meshy",
            model: config.geometryModel,
            externalId: job.externalId,
          });
          job.outputAssetId = asset.id;
          await writeLocalProject(config.stateDir, project);
        } else {
          await writeLocalProject(config.stateDir, project);
        }

        return ok({ projectId: project.id, job, provider: result, asset: asset ?? null });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "check_crafthinkera_connection",
    {
      description: "Verify the optional hosted CrafThinkERA bearer token and list the remote production/commerce tools. No side effect.",
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {},
    },
    async () => {
      if (!config.token) return ok({ connected: false, reason: "CRAFTHINKERA_MCP_TOKEN not configured" });
      const client = new Client({ name: "crafty-local-network-check", version: VERSION }, { capabilities: {} });
      try {
        const transport = new StreamableHTTPClientTransport(config.url, {
          requestInit: {
            headers: { Authorization: `Bearer ${config.token}` },
          },
        });
        await client.connect(transport);
        const tools = await client.listTools();
        return ok({ connected: true, endpoint: config.url.href, tools: tools.tools.map((tool) => tool.name) });
      } catch (error) {
        return fail(error);
      } finally {
        await client.close().catch(() => undefined);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
