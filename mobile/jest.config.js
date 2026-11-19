module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!(jest-|@react-native|expo|@expo|react-native|@react-navigation|@unimodules|sentry-expo|native-base|@sentry))",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/tests/**/*.test.{ts,tsx}"],
  testEnvironment: "jsdom",
  setupFilesAfterSetup: ["@testing-library/jest-native/extend-expect"],
};