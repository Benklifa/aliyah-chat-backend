export default async function handler(req, res) {
  const VERSION = "v14";

  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // you can restrict to your domain if you want
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Health check route ---
  if (req.method === "GET" && req.url === "/health") {
    return res.status(200).json({
      version: VERSION,
      ok: true,
      node: process.version,
      hasKey: !!process.env.OPENAI_API_KEY
    });
  }

  // --- Chat endpoint ---
  if (req.method === "POST" && req.url === "/chat") {
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
        reply: "I recommend contacting Aliya Financial to schedule a consultation for personalized cross-border financial guidance."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error(`[${VERSION}] ❌ Missing OPENAI_API_KEY`);
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    try {
      console.log(`[${VERSION}] 🌐 Sending request to OpenAI...`);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are Aliya Buddy, a warm, knowledgeable assistant helping people navigate the journey of making Aliyah to Israel. " +
                "Keep your answers short, clear, and conversational — 2 to 4 sentences max. " +
                "Focus on being friendly and practical, like a chat with a helpful friend. " +
                "If you don’t know something, say so honestly and suggest where to look."
            },
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 150 // 👈 ensures short, chat-style replies
        })
      });

      const raw = await response.text();
      console.log(`[${VERSION}] 📥 OpenAI status: ${response.status}`);
      console.log(`[${VERSION}] 📜 OpenAI raw response: ${raw}`);

      if (!response.ok) {
        return res.status(response.status).json({ error: raw });
      }

      const data = JSON.parse(raw);
      const reply = data?.choices?.[0]?.message?.content?.trim() || "";
      return res.json({ reply });
    } catch (error) {
      console.error(`[${VERSION}] ❌ Unexpected error:`, error);
      return res.status(500).json({ error: error.message || "Unknown error" });
    }
  }

  // --- Default fallback ---
  return res.status(405).json({ error: "Method not allowed" });
}
