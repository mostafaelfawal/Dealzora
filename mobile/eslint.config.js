// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores(["dist/*", ".expo/*", "android/*", "ios/*"]),
  expoConfig,
  {
    rules: {
      // لا console.log في التطبيق (حماية من تسريب توكنات في اللوجات).
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
]);
