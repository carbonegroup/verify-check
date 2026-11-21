/**
 * Dynamic Expo config.
 *
 * The optional APP_VERSION variable lets CI/EAS select an app version
 * without modifying app.json or dirtying the Git working tree.
 */
export default ({ config }) => {
  const requestedVersion = process.env.APP_VERSION?.trim();

  if (!requestedVersion) {
    return config;
  }

  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(requestedVersion)) {
    throw new Error(
      "APP_VERSION invalide : utilise 1 à 64 caractères alphanumériques, points, + ou -."
    );
  }

  return {
    ...config,
    version: requestedVersion,
  };
};
