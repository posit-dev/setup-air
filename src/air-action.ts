import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "node:path";
import {
  downloadVersion,
  resolveVersion,
  tryGetFromToolCache,
} from "./download/download-version";
import {
  type Architecture,
  getArch,
  getPlatform,
  type Platform,
} from "./utils/platforms";
import { INPUT_ARGS, INPUT_VERSION, INPUT_GITHUB_TOKEN } from "./utils/inputs";

async function run(): Promise<void> {
  const platform = getPlatform();
  const arch = getArch();

  try {
    if (platform === undefined) {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
    if (arch === undefined) {
      throw new Error(`Unsupported architecture: ${process.arch}`);
    }

    const setupResult = await setupAir(
      platform,
      arch,
      INPUT_VERSION,
      INPUT_GITHUB_TOKEN,
    );

    addAirToPath(setupResult.airDir);
    core.setOutput("air-version", setupResult.version);
    core.info(`Successfully installed Air version ${setupResult.version}`);

    if (INPUT_ARGS.length > 0) {
      await runAir(path.join(setupResult.airDir, "air"), INPUT_ARGS.split(" "));
    }

    process.exit(0);
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

async function setupAir(
  platform: Platform,
  arch: Architecture,
  version: string,
  githubToken: string,
): Promise<{ airDir: string; version: string }> {
  const resolvedVersion = await determineVersion(version, githubToken);

  const toolCacheResult = tryGetFromToolCache(arch, resolvedVersion);
  if (toolCacheResult.installedPath) {
    core.info(`Found airDir in tool-cache for ${toolCacheResult.version}`);
    return {
      airDir: toolCacheResult.installedPath,
      version: toolCacheResult.version,
    };
  }

  const downloadVersionResult = await downloadVersion(
    platform,
    arch,
    resolvedVersion,
    githubToken,
  );

  return {
    airDir: downloadVersionResult.cachedToolDir,
    version: downloadVersionResult.version,
  };
}

async function determineVersion(
  version: string,
  githubToken: string,
): Promise<string> {
  return version !== ""
    ? await resolveVersion(version, githubToken)
    : await resolveVersion("latest", githubToken);
}

function addAirToPath(cachedPath: string): void {
  core.addPath(cachedPath);
  core.info(`Added ${cachedPath} to the path`);
}

async function runAir(
  airExecutablePath: string,
  args: string[],
): Promise<void> {
  await exec.exec(airExecutablePath, args);
}

run();
