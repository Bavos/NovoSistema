import unzipper from 'unzipper';
import path from 'path';
import fs from 'fs';

/**
 * Validates whether a file path resolves strictly within the target directory.
 * Prevents Zip Slip (path traversal) vulnerabilities.
 */
export function isPathInsideDirectory(filePath: string, targetDirectory: string): boolean {
  const resolvedTarget = path.resolve(targetDirectory);
  const resolvedFile = path.resolve(resolvedTarget, filePath);
  return (
    resolvedFile === resolvedTarget ||
    resolvedFile.startsWith(resolvedTarget + path.sep)
  );
}

/**
 * Safely extracts a zip archive buffer or file into targetDirectory,
 * validating that every extracted file path remains strictly contained inside targetDirectory.
 */
export async function extractZipSafely(
  zipBufferOrPath: Buffer | string,
  targetDirectory: string
): Promise<void> {
  const resolvedTargetDir = path.resolve(targetDirectory);

  let directory: unzipper.CentralDirectory;
  if (typeof zipBufferOrPath === 'string') {
    directory = await unzipper.Open.file(zipBufferOrPath);
  } else {
    directory = await unzipper.Open.buffer(zipBufferOrPath);
  }

  for (const file of directory.files) {
    const targetPath = path.resolve(resolvedTargetDir, file.path);

    // Security check: validate that target path stays strictly inside target directory
    if (!isPathInsideDirectory(file.path, resolvedTargetDir)) {
      throw new Error(`Security Exception: Path traversal attempt detected for file '${file.path}'`);
    }

    if (file.type === 'Directory') {
      await fs.promises.mkdir(targetPath, { recursive: true });
    } else {
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      const content = await file.buffer();
      await fs.promises.writeFile(targetPath, content);
    }
  }
}
