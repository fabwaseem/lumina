import { readdir, stat } from "fs/promises";
import { createWriteStream } from "fs";
import { join, basename } from "path";
import { isModelHash, parsePositiveInt, sanitizeFilename } from "./lib/validate";

const CIVITAI_API = "https://civitai.com/api/v1";
const LORA_SLOTS = 8;

interface LoraResource {
  name: string;
  type: string;
  weight?: number;
  hash?: string;
  modelVersionId?: number;
}

function isLora(r: LoraResource): boolean {
  const t = (r.type ?? "").toLowerCase();
  return t === "lora" || t === "loras";
}

function safeFilename(name: string): string {
  const base = name.replace(/[<>:"/\\|?*]/g, "_").trim();
  return base.endsWith(".safetensors") ? base : `${base}.safetensors`;
}

async function findInFolder(
  lorasPath: string,
  resourceName: string
): Promise<string | null> {
  try {
    const entries = await readdir(lorasPath, { withFileTypes: true });
    const lower = resourceName.toLowerCase();
    const candidates = entries.filter(
      (e) =>
        e.isFile() &&
        (e.name.toLowerCase().includes(lower) ||
          lower.includes(e.name.replace(/\.(safetensors|pt)$/i, "")))
    );
    if (candidates.length > 0) return candidates[0].name;
    const exact = safeFilename(resourceName);
    if (entries.some((e) => e.isFile() && e.name === exact)) return exact;
    return null;
  } catch {
    return null;
  }
}

export interface LoraDownloadProgress {
  filename: string;
  bytesReceived: number;
  contentLength: number | null;
  percent: number | null;
}

async function downloadToFileWithProgress(
  modelVersionId: number,
  destPath: string,
  token: string | undefined,
  filename: string,
  onProgress: (p: LoraDownloadProgress) => void
): Promise<boolean> {
  if (!parsePositiveInt(modelVersionId)) return false;
  const url = `https://civitai.com/api/download/models/${modelVersionId}${
    token ? `?token=${encodeURIComponent(token)}` : ""
  }`;
  console.log("[LoRA] download start", filename, "versionId", modelVersionId);
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(30 * 60 * 1000),
    });
  } catch (err) {
    console.log("[LoRA] download failed", filename, err);
    return false;
  }
  if (!res.ok || !res.body) {
    console.log("[LoRA] download failed", filename, "status", res.status);
    return false;
  }
  const contentLength = res.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : null;
  if (total != null)
    console.log("[LoRA] download size", filename, total, "bytes");
  let bytesReceived = 0;
  const writable = createWriteStream(destPath);
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      writable.write(value);
      bytesReceived += value.length;
      onProgress({
        filename,
        bytesReceived,
        contentLength: total,
        percent:
          total != null && total > 0
            ? Math.min(100, (bytesReceived / total) * 100)
            : null,
      });
    }
    writable.end();
    await new Promise<void>((resolve, reject) => {
      writable.on("finish", () => resolve());
      writable.on("error", reject);
    });
    console.log("[LoRA] download finish", filename, bytesReceived, "bytes");
    return true;
  } catch (err) {
    console.log("[LoRA] download error", filename, err);
    writable.destroy();
    return false;
  }
}

export async function resolveLoraFilenames(
  resources: LoraResource[],
  lorasPath: string,
  civitaiToken?: string
): Promise<Array<{ filename: string; strength: number }>> {
  return resolveLoraFilenamesWithProgress(
    resources,
    lorasPath,
    civitaiToken,
    undefined
  );
}

async function getVersionInfo(
  hash: string | undefined,
  modelVersionId: number | undefined,
  civitaiToken: string | undefined
): Promise<{ versionId: number; primaryName: string } | null> {
  let versionId: number | undefined;
  let primaryName: string | null = null;
  if (modelVersionId != null && Number.isFinite(modelVersionId)) {
    console.log("[LoRA] getVersionInfo by modelVersionId", modelVersionId);
    try {
    const res = await fetch(`${CIVITAI_API}/model-versions/${modelVersionId}`, {
      headers: civitaiToken ? { Authorization: `Bearer ${civitaiToken}` } : {},
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const ver = (await res.json()) as {
        id?: number;
        files?: Array<{ name: string; primary?: boolean }>;
      };
      versionId = ver.id ?? modelVersionId;
      const files = ver.files ?? [];
      const primary = files.find((f) => f.primary) ?? files[0];
      primaryName = primary?.name ?? null;
      console.log(
        "[LoRA] getVersionInfo modelVersionId result:",
        versionId,
        primaryName
      );
    }
    } catch (err) {
      console.log("[LoRA] getVersionInfo modelVersionId failed", err);
    }
  }
  if ((!versionId || !primaryName) && hash && isModelHash(hash)) {
    console.log("[LoRA] getVersionInfo by hash", hash);
      let hashRes: Response;
      try {
      hashRes = await fetch(
      `${CIVITAI_API}/model-versions/by-hash/${encodeURIComponent(hash)}`,
      {
        headers: civitaiToken
          ? { Authorization: `Bearer ${civitaiToken}` }
          : {},
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (hashRes.ok) {
      const ver = (await hashRes.json()) as {
        id?: number;
        files?: Array<{ name: string; primary?: boolean }>;
      };
      versionId = ver.id ?? versionId;
      const files = ver.files ?? [];
      const primary = files.find((f) => f.primary) ?? files[0];
      primaryName = primary?.name ?? primaryName;
      console.log("[LoRA] getVersionInfo hash result:", versionId, primaryName);
    }
      } catch (err) {
        console.log("[LoRA] getVersionInfo hash failed", err);
      }
  }
  if (versionId != null && primaryName) {
    return {
      versionId,
      primaryName: sanitizeFilename(basename(primaryName), "lora.safetensors"),
    };
  }
  console.log("[LoRA] getVersionInfo no version found");
  return null;
}

export async function resolveLoraFilenamesWithProgress(
  resources: LoraResource[],
  lorasPath: string,
  civitaiToken: string | undefined,
  onProgress: ((p: LoraDownloadProgress) => void) | undefined
): Promise<Array<{ filename: string; strength: number }>> {
  const loras = resources
    .filter(
      (r) =>
        isLora(r) &&
        (r.hash ||
          (r.modelVersionId != null && Number.isFinite(r.modelVersionId)))
    )
    .slice(0, LORA_SLOTS);
  console.log("[LoRA] resolveLoraFilenamesWithProgress", {
    lorasPath,
    inputResources: resources.length,
    lorasCount: loras.length,
    names: loras.map((r) => r.name),
  });
  const result: Array<{ filename: string; strength: number }> = [];

  for (const r of loras) {
    let filename: string | null = await findInFolder(lorasPath, r.name);
    console.log(
      "[LoRA] resource",
      r.name,
      "findInFolder:",
      filename ?? "not found"
    );

    if (!filename) {
      const info = await getVersionInfo(r.hash, r.modelVersionId, civitaiToken);
      if (info) {
        const { versionId, primaryName } = info;
        const destPath = join(lorasPath, primaryName);
        try {
          await stat(destPath);
          filename = primaryName;
          console.log(
            "[LoRA] resource",
            r.name,
            "already on disk:",
            primaryName
          );
        } catch {
          console.log("[LoRA] resource", r.name, "downloading", primaryName);
          const ok = await downloadToFileWithProgress(
            versionId,
            destPath,
            civitaiToken,
            primaryName,
            (p) => onProgress?.(p)
          );
          if (ok) {
            filename = primaryName;
            console.log(
              "[LoRA] resource",
              r.name,
              "download done:",
              primaryName
            );
          } else {
            console.log("[LoRA] resource", r.name, "download failed");
          }
        }
      }
    }

    if (!filename) filename = await findInFolder(lorasPath, r.name);
    if (filename) {
      result.push({ filename, strength: r.weight ?? 1 });
      console.log(
        "[LoRA] resource",
        r.name,
        "->",
        filename,
        "strength",
        r.weight ?? 1
      );
    } else {
      console.log("[LoRA] resource", r.name, "skipped (no filename)");
    }
  }

  console.log(
    "[LoRA] resolveLoraFilenamesWithProgress done, resolved:",
    result.length
  );
  return result;
}

export function buildLoraInputs(
  resolved: Array<{ filename: string; strength: number }>
): Record<string, { on: boolean; lora: string; strength: number }> {
  const inputs: Record<
    string,
    { on: boolean; lora: string; strength: number }
  > = {};
  resolved.slice(0, LORA_SLOTS).forEach((entry, i) => {
    inputs[`lora_${i + 1}`] = {
      on: true,
      lora: entry.filename,
      strength: entry.strength,
    };
  });
  console.log(
    "[LoRA] buildLoraInputs",
    Object.keys(inputs).length,
    "slots",
    Object.entries(inputs).map(([k, v]) => `${k}=${v.lora}`)
  );
  return inputs;
}
