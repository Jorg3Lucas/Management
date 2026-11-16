import fs from "node:fs";
import path from "node:path";

/** Cache de build/desenvolvimento do Next: sempre pode ser apagado e recriado. */
const targets = [".next/cache", ".next/dev", "tsconfig.tsbuildinfo"];

function sizeOf(target: string): number {
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.size;
  return fs.readdirSync(target, { withFileTypes: true }).reduce((total, entry) => {
    return total + sizeOf(path.join(target, entry.name));
  }, 0);
}

let freed = 0;
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  const size = sizeOf(target);
  fs.rmSync(target, { recursive: true, force: true });
  freed += size;
  console.log(`removido ${target} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

console.log(freed ? `Total liberado: ${(freed / 1024 / 1024).toFixed(1)} MB.` : "Nada para limpar.");
