# Dependency security overrides

This repository uses npm in two independent projects: the web app at the repository root and the Expo app in `mobile/`. Keep both lockfiles in sync with their manifests.

## Why overrides exist

Some vulnerable packages are pinned transitively by the currently installed Next.js / Expo SDK dependency trees. The overrides below select fixed upstream releases without forcing an unrelated Next.js 16 or Expo SDK 58 migration.

| Project | Package | Resolved version | Reason |
|---|---|---:|---|
| Root | `postcss` | `8.5.23` | Fixed release for GHSA-fxqj-rqcc-2cmp |
| Root | `zod` | `4.6.7` | Fixed release for GHSA-mrhx-c7xc-m3w5 |
| Mobile | `postcss` | `8.5.23` | Fixed PostCSS release |
| Mobile | `@xmldom/xmldom` under `@expo/plist` | `0.8.15` | Patched maintained 0.8 line |
| Mobile | `fast-xml-parser` | `5.12.0` | Fixed release for GHSA-474x-hrwr-fgx4 |
| Mobile | `send` | `0.19.2` | Patched 0.19 line |
| Mobile | `tar` | `7.5.23` | Includes fixes through GHSA-r292-9mhp-454m |
| Mobile | `glob` under `cacache` | `14.0.2` | Fixed release for GHSA-3g3m-2fjr-6pw4 |
| Mobile | `minimatch` under `cacache` | `11.0.1` | Fixed release for GHSA-g3hv-75wg-m249 |
| Mobile | `uuid` | `11.1.1` | Fixed release for GHSA-w5hq-g745-h8pq |
| Mobile | `image-size` | `2.1.0` | Release beyond the affected 2.0.2 ceiling |
| Mobile | `zod` | `4.6.7` | Fixed release for GHSA-mrhx-c7xc-m3w5 |

These overrides intentionally affect transitive dependencies. A major-version override is not proof of API compatibility: clean installs, Expo validation, typechecks, tests and builds must pass before merging. In particular, review any failure involving Expo CLI, Metro, archive extraction, globbing, UUID generation or image metadata.

## Maintenance

- Keep `package-lock.json` and `mobile/package-lock.json` synchronized with their respective manifests.
- Run `npm audit` at the root and `npm audit` from `mobile/` after dependency updates.
- Prefer removing an override only after its parent package releases a compatible fixed dependency and the lockfile resolves to that fixed version.
- Do not use `npm audit fix --force` as a substitute for compatibility review.
- Dependabot monitors both npm directories and GitHub Actions weekly; security updates are grouped per ecosystem.

The mobile Expo SDK upgrade remains a separate compatibility project. Do not infer that this targeted dependency patch upgrades or modernizes the Expo SDK itself.
