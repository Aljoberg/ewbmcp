import { Elysia } from "elysia";
import { handler } from ".";
const app = new Elysia();

app.get("/api/:transport", async ({ request }) => await handler(request));
app.post("/api/:transport", async ({ request }) => await handler(request));

app.listen(3000, () => console.log("UP"));
