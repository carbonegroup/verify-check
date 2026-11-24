import { access, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export function patchExpoCliTarImport(source) {
  const compiledDefaultImport =
    /((?:const|let|var)\s+)([A-Za-z_$][\w$]*)(\s*=\s*)(?:\/\*#__PURE__\*\/\s*)?_interopRequireDefault\s*\(\s*require\(\s*(['"])tar\4\s*\)\s*\)\s*;?/g;

  const matches = [...source.matchAll(compiledDefaultImport)];
  if (matches.length > 0) {
    const patched = source.replace(
      compiledDefaultImport,
      (_match, declaration, binding, assignment) =>
        declaration + binding + assignment + '{ default: require("tar") };'
    );
    return {
      source: patched,
      changed: true,
      replacements: matches.length,
      bindings: matches.map((match) => match[2]),
    };
  }

  const alreadyPatched =
    /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*\{\s*default:\s*require\(\s*(['"])tar\1\s*\)\s*\}/;
  if (alreadyPatched.test(source)) {
    return { source, changed: false, replacements: 0, bindings: [] };
  }

  throw new Error(
    'Could not locate the expected compiled @expo/cli default import of tar. Refusing to modify an unknown bundle shape.'
  );
}

async function main() {
  if (process.env.npm_config_package_lock_only === 'true') {
    process.stdout.write('[expo-cli-tar-patch] Skipped during package-lock-only resolution.\n');
    return;
  }

  const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const tarNamespace = require('tar');
  if (typeof tarNamespace?.extract !== 'function') {
    throw new Error('The installed tar package does not expose a callable named export "extract".');
  }

  const cliEntrypoint = require.resolve('@expo/cli', { paths: [mobileRoot] });
  const cliBuildDir = resolve(dirname(cliEntrypoint), '..');
  const targetFile = resolve(cliBuildDir, 'src/utils/npm.js');
  await access(targetFile);

  const original = await readFile(targetFile, 'utf8');
  const result = patchExpoCliTarImport(original);
  const checkOnly = process.argv.includes('--check');

  if (checkOnly && result.changed) {
    throw new Error('The @expo/cli tar compatibility patch is missing; npm postinstall did not apply it.');
  }

  if (result.changed) {
    await writeFile(targetFile, result.source, 'utf8');
    process.stdout.write(
      '[expo-cli-tar-patch] Wrapped tar CommonJS namespace as a default export (' +
      result.replacements +
      ' import(s): ' +
      result.bindings.join(', ') +
      ').\n'
    );
  } else {
    process.stdout.write('[expo-cli-tar-patch] @expo/cli tar default interop verified.\n');
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write('[expo-cli-tar-patch] ' + error.message + '\n');
    process.exitCode = 1;
  });
}
