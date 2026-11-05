import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

/**
 * Validate the SHA-256 checksum of a downloaded artifact against the `.sha256`
 * file that Air publishes alongside every release asset.
 *
 * Throws if the checksum file can't be retrieved or doesn't match.
 */
export async function validateChecksum(
  downloadPath: string,
  downloadUrl: string,
  githubToken: string,
): Promise<void> {
  const checksumUrl = `${downloadUrl}.sha256`;
  core.debug(`Downloading checksum from "${checksumUrl}" ...`);

  const checksumPath = await tc.downloadTool(
    checksumUrl,
    undefined,
    githubToken,
  );

  // Format is `<hex>  <filename>`, so we split on the `" "`
  const contents = await fs.promises.readFile(checksumPath, "utf8");
  const expected = contents.trim().split(" ")[0]?.toLowerCase();

  if (expected === undefined || !/^[0-9a-f]{64}$/.test(expected)) {
    throw new Error(`Malformed checksum file at "${checksumUrl}".`);
  }

  const actual = await computeSha256(downloadPath);

  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for "${downloadUrl}". Expected ${expected}, got ${actual}.`,
    );
  }

  core.info(`Checksum verified: ${actual}`);
}

async function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => reject(err));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
