import express from "express";
import yemotHandler from "./api/yemot.js";

const app = express();
const port = Number.parseInt(process.env.PORT || "3000", 10);

app.disable("x-powered-by");
app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "yemot-election-updates" }));
app.all("/api/yemot", (req, res) => yemotHandler(req, res));
app.listen(port, "0.0.0.0", () => {
  console.log(`Yemot Election Updates listening on port ${port}`);
});
