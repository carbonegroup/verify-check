import { access, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

function escapeRegExp(value) {
  return value.replace(/\$/g, '\\$&');
}

export function patchExpoCliTarImport(source) {
  const importedTar = source.match(
    /(?:^|\n)\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n;]*\brequire\(\s*(['"])tar\3\s*\)[^\n;]*)\s*;?/m
  );

  if (!importedTar) {
    throw new Error('Could not locate the compiled @expo/cli import of the tar package.');
  }

  const binding = importedTar[1];
  const escapedBinding = escapeRegExp(binding);
  const brokenAccess = new RegExp('(^|[^A-Za-z0-9_$])' + escapedBinding + '\\.default\\.extract\\b', 'g');
  const brokenMatches = [...source.matchAll(brokenAccess)].length;

  if (brokenMatches === 0) {
    const workingAccess = new RegExp('(^|[^A-Za-z0-9_$])' + escapedBinding + '\\.extract\\b');
    if (workingAccess.test(source)) {
      return { source, changed: false, binding };
    }
    const diagnosticLines = source.split('\n').filter((line) => line.includes(binding) || /extract/i.test(line)).slice(0, 30);
    throw new Error(
      'Found the tar import in @expo/cli, but not the expected extract access. Import: ' +
      importedTar[0].trim() +
      ' | Relevant lines: ' +
      diagnosticLines.join(' || ')
    );
  }

  const patched = source.replace(brokenAccess, (match, prefix) => prefix + binding + '.extract');
  const workingAccess = new RegExp('(^|[^A-Za-z0-9_$])' + escapedBinding + '\\.extract\\b');
  if (!workingAccess.test(patched)) {
    throw new Error('The @expo/cli tar import patch did not produce a valid extract call.');
  }

  return { source: patched, changed: true, binding, replacements: brokenMatches };
}

async function main() {
  if (process.env.npm_config_package_lock_only === 'true') {
    process.stdout.write('[expo-cli-tar-patch] Skipped during package-lock-only resolution.\\n');
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
    process.stdout.write('[expo-cli-tar-patch] Repaired @expo/cli tar.extract interop (' + result.replacements + ' call(s)).\n');
  } else {
    process.stdout.write('[expo-cli-tar-patch] @expo/cli tar.extract interop verified.\n');
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write('[expo-cli-tar-patch] ' + error.message + '\n');
    process.exitCode = 1;
  });
}
