import assert from 'node:assert/strict';
import test from 'node:test';
import { patchExpoCliTarImport } from '../scripts/patch-expo-cli-tar.mjs';

test('wraps the compiled Expo CLI default tar import around the tar namespace', () => {
  const source = [
    'const data = /*#__PURE__*/ _interopRequireDefault(require("tar"));',
    'const other = /*#__PURE__*/ _interopRequireDefault(require("other"));',
  ].join('\n');
  const result = patchExpoCliTarImport(source);
  assert.equal(result.changed, true);
  assert.equal(result.replacements, 1);
  assert.deepEqual(result.bindings, ['data']);
  assert.match(result.source, /const data = \{ default: require\("tar"\) \};/);
  assert.match(result.source, /const other = .*require\("other"\)/);
});

test('supports non-minified CommonJS declaration spacing and quote styles', () => {
  const source = "var tarClient = _interopRequireDefault(require('tar'));";
  const result = patchExpoCliTarImport(source);
  assert.equal(result.changed, true);
  assert.match(result.source, /var tarClient = \{ default: require\("tar"\) \};/);
});

test('is idempotent after the tar default namespace has been wrapped', () => {
  const source = 'const data = { default: require("tar") };';
  const result = patchExpoCliTarImport(source);
  assert.equal(result.changed, false);
  assert.equal(result.source, source);
});

test('fails closed when Expo changes its compiled module shape', () => {
  assert.throws(
    () => patchExpoCliTarImport('const data = require("tar");'),
    /Refusing to modify an unknown bundle shape/
  );
});

test('does not change imports of packages other than tar', () => {
  const source = 'const data = _interopRequireDefault(require("other"));';
  assert.throws(() => patchExpoCliTarImport(source), /unknown bundle shape/);
});
