import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createLocalProject,
  readLocalProject,
  storeLocalAsset,
} from "../src/local/state.js";

test("creates a durable local project and checksum-addressed asset metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "crafty-test-"));
  const project = await createLocalProject({ stateDir: root, intent: "Make a small resin desk figure." });
  const bytes = Buffer.from("fake-image-bytes");
  const asset = await storeLocalAsset({
    stateDir: root,
    project,
    role: "concept",
    bytes,
    contentType: "image/png",
    provider: "test",
    model: "test",
  });
  assert.equal(asset.byteSize, bytes.length);
  assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  const reread = await readLocalProject(root, project.id);
  assert.equal(reread.assets.length, 1);
  const saved = await readFile(join(root, "projects", project.id, "assets", asset.fileName));
  assert.deepEqual(saved, bytes);
});

test("refuses path traversal through a project id", async () => {
  const root = await mkdtemp(join(tmpdir(), "crafty-test-"));
  await assert.rejects(() => readLocalProject(root, "../../etc/passwd"), /invalid_local_project_id/);
});
