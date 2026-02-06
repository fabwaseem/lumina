/* eslint-disable import/namespace, import/default, import/no-named-as-default, import/no-named-as-default-member */
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig(async () => {
  const [react, tailwindcss] = await Promise.all([
    import("@vitejs/plugin-react"),
    import("@tailwindcss/vite"),
  ]);
  return {
    plugins: [react.default(), tailwindcss.default()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
