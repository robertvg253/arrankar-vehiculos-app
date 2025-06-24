import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

/**
 * Plugin para ignorar las peticiones de Chrome DevTools que causan errores 404
 * en el servidor de desarrollo de Vite, desestabilizando la conexión WebSocket.
 */
function ignoreDevToolsJsonPlugin(): Plugin {
  return {
    name: 'ignore-dev-tools-json',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.includes('/.well-known/appspecific/com.chrome.devtools.json')) {
          res.writeHead(204); // HTTP 204 No Content
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
    ignoreDevToolsJsonPlugin(),
  ],
});
