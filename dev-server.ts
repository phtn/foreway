import dev from "./examples/dev/index.html";

const port = Number(process.env.PORT ?? 3000);

Bun.serve({
  port,
  routes: {
    "/": dev,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.info(`Foreway dev server running at http://localhost:${port}`);
