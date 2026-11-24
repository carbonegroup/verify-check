import assert from 'node:assert/strict';
import test from 'node:test';
import { patchExpoCliTarImport } from '../scripts/patch-expo-cli-tar.mjs';

test('replaces a broken default extract access with the named tar export', () => {
  const source = [
    'var tar_1 = _interop_require_default(require("tar"));',
    '(0, tar_1.default.extract)({ cwd: output });',
  ].join('\n');
  const result = patchExpoCliTarImport(source);
  assert.equal(result.changed, true);
  assert.equal(result.replacements, 1);
  assert.match(result.source, /tar_1\.extract/);
  assert.doesNotMatch(result.source, /tar_1\.default\.extract/);
});

test('supports a direct require binding', () => {
  const source = "const tar = require('tar');\ntar.default.extract({});";
  const result = patchExpoCliTarImport(source);
  assert.equal(result.changed, true);
  assert.match(result.source, /tar\.extract/);
});

test('is idempotent when the named export is already used', () => {
  const source = 'var tar_1 = require("tar");\ntar_1.extract({});';
  const result = patchExpoCliTarImport(source);
  assert.equal(result.changed, false);
  assert.equal(result.source, source);
});

test('fails closed when Expo changes its compiled module shape', () => {
  assert.throws(
    () => patchExpoCliTarImport('var other = require("other");'),
    /Could not locate the compiled @expo\/cli import/
  );
});
