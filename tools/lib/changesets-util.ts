import getReleasePlan from "@changesets/get-release-plan";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention -- standard Node.js convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention -- standard Node.js convention
const __dirname = path.dirname(__filename);

/** Get new version string from changesets */
export async function getNewVersion(): Promise<string> {
  const releasePlan = await getReleasePlan(path.resolve(__dirname, "../.."));

  return releasePlan.releases.find(({ name }) => name === "yaml-eslint-parser")!
    .newVersion;
}
