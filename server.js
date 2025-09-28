export default async function handler(req, res) {
  const VERSION = "v11";

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userMessage = req.body.message || "";
  console.log(`[${VERSION}] /chat called with: "${userMessage}"`);

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
          { role: "system", content: "You are Aliya Buddy, a warm, knowledgeable assistant who helps people with Aliyah to Israel." },
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
}
