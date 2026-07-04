import { Elysia } from "elysia";
import { handler } from ".";
const app = new Elysia();

// handler is supposed to be used in next.js, but that's too much overhead for a simple mcp
// but it works with standard Request & Response objects, which Elysia supports
// so we just use that
app.get("/api/:transport", async ({ request }) => await handler(request));
app.post("/api/:transport", async ({ request }) => await handler(request));

app.listen(3000, () => console.log("UP"));
