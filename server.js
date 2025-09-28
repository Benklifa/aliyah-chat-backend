const express = require("express");
require("dotenv").config();

const VERSION = "v11";
const PORT = 3001;

const app = express();
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send(`Aliyah Chat Backend is running 🚀 (${VERSION}) on port ${PORT}`);
});

// Debug route
app.get("/debug", (req, res) => {
  res.json({
    version: VERSION,
    script: __filename,
    keyLoaded: !!process.env.OPENAI_API_KEY,
    node: process.version,
    port: PORT,
  });
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message || "";
  console.log(`[${VERSION}] /chat called with: "${userMessage}"`);

  // Quick keyword redirect
  const financialKeywords = [
    "investment", "retirement", "tax", "insurance", "mortgage",
    "wealth", "budget", "currency", "finance", "financial"
  ];
  if (financialKeywords.some(k => userMessage.toLowerCase().includes(k))) {
    console.log(`[${VERSION}] financial keyword detected`);
    return res.json({
      reply: "I recommend contacting Aliya Financial to schedule a consultation for personalized financial guidance."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error(`[${VERSION}] ❌ Missing OPENAI_API_KEY`);
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    console.log(`[${VERSION}] 🌐 Sending request to OpenAI...`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // safe fallback model
        messages: [
          { role: "system", content: "You are Aliyah Guide, a warm, knowledgeable assistant who helps people with Aliyah to Israel." },
          { role: "user", content: userMessage }
        ]
      })
    });

    const raw = await response.text();
    console.log(`[${VERSION}] 📥 OpenAI status: ${response.status}`);
    console.log(`[${VERSION}] 📜 OpenAI raw response: ${raw}`);

    if (!response.ok) {
      return res.status(response.status).json({ error: raw });
    }

    const data = JSON.parse(raw);
    const reply = data?.choices?.[0]?.message?.content || "";
    return res.json({ reply });
  } catch (error) {
    console.error(`[${VERSION}] ❌ Unexpected error:`, error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
});

// Custom 404
app.use((req, res) => {
  console.log(`[${VERSION}] 404 for ${req.method} ${req.url}`);
  res.status(404).json({
    version: VERSION,
    message: "Route not found",
    method: req.method,
    url: req.url
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${VERSION})`);
});
