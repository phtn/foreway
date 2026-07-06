import dev from "./examples/dev/index.html";

const port = Number(process.env.PORT ?? 3000);

Bun.serve({
  port,
  routes: {
    "/": dev,
    "/favicon.ico": new Response(Bun.file("./favicon.ico"), {
      headers: {
        "Content-Type": "image/x-icon",
      },
    }),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.info(`Foreway dev server running at http://localhost:${port}`);
