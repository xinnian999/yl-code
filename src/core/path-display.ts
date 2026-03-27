import path from "node:path";

function normalizeSeparators(value: string): string {
  return value.split(path.sep).join("/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAbsolutePath(targetPath: string): string {
  return path.normalize(
    path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(process.cwd(), targetPath)
  );
}

export function toDisplayPath(targetPath: string): string {
  if (!targetPath.trim()) return targetPath;

  const absolutePath = getAbsolutePath(targetPath);
  const relativePath = path.relative(process.cwd(), absolutePath);
  return normalizeSeparators(relativePath || ".");
}

export function sanitizeDisplayText(
  text: string,
  ...paths: Array<string | undefined>
): string {
  const candidates = new Set<string>();
  candidates.add(getAbsolutePath(process.cwd()));

  for (const candidate of paths) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    candidates.add(getAbsolutePath(candidate));
  }

  let result = text;
  const orderedPaths = Array.from(candidates).sort((a, b) => b.length - a.length);

  for (const absolutePath of orderedPaths) {
    const displayPath = absolutePath === getAbsolutePath(process.cwd())
      ? "."
      : toDisplayPath(absolutePath);
    result = result.replace(new RegExp(escapeRegExp(absolutePath), "g"), displayPath);
  }

  return normalizeSeparators(result);
}

export function toDisplayCommand(command: string): string {
  return sanitizeDisplayText(command);
}
