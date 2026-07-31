import { describe, it, expect } from 'vitest';
import { isPathInsideDirectory } from './zipUtils';

describe('isPathInsideDirectory', () => {
  it('should accept valid relative file paths inside target directory', () => {
    expect(isPathInsideDirectory('data/subfolder/file.txt', '/tmp/extract')).toBe(true);
    expect(isPathInsideDirectory('file.txt', '/tmp/extract')).toBe(true);
  });

  it('should reject path traversal attempts (Zip Slip)', () => {
    expect(isPathInsideDirectory('../file.txt', '/tmp/extract')).toBe(false);
    expect(isPathInsideDirectory('../../etc/passwd', '/tmp/extract')).toBe(false);
    expect(isPathInsideDirectory('folder/../../etc/passwd', '/tmp/extract')).toBe(false);
  });
});
