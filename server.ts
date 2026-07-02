import { Elysia } from "elysia";
import { handler } from ".";
const app = new Elysia();

app.get("/api/:transport", ({ request }) => handler(request));
app.post("/api/:transport", ({ request }) => handler(request));

app.listen(3000, () => console.log("UP"));