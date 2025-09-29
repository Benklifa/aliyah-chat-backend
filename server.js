// server.js

let pendingOffer = null;

// --- Trusted Source Library ---
const resourceLinks = {
  government: "https://www.gov.il/en/departments/immigration_and_absorption",
  nbn: "https://www.nbn.org.il/aliyahpedia/",
  numbeo: "https://www.numbeo.com/cost-of-living/",
  finance: "https://aliyabrd-s23wab.manus.space/"
};

// --- Follow-up library ---
const followUps = {
  culture: [
    "Would you like me to share more about daily life in Israel?",
    "Do you want me to outline some cultural differences you might notice right away?"
  ],
  community: [
    "Should I suggest ways to connect with local Anglo communities?",
    "Would you like me to highlight WhatsApp or Facebook groups where Anglos stay connected?"
  ],
  cost: [
    "Would you like me to compare costs between cities like Tel Aviv, Jerusalem, and Haifa?",
    "Should I break down typical monthly expenses for a family of four?"
  ],
  general: [
    "What part of this feels most relevant to your Aliyah journey?",
    "Would you like me to suggest the next steps you could take?"
  ]
};

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickFollowUp(userMessage) {
  const msg = userMessage.toLowerCase();
  if (msg.includes("community") || msg.includes("anglo")) return random(followUps.community);
  if (msg.includes("culture") || msg.includes("holiday")) return random(followUps.culture);
  if (msg.includes("cost") || msg.includes("apartment") || msg.includes("living")) return random(followUps.cost);
  return random(followUps.general);
}

export default async function handler(req, res) {
  const VERSION = "v23";

  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Health check ---
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
    const userMessage = (req.body.message || "").trim();
    console.log(`[${VERSION}] /chat called with: "${userMessage}"`);

    // --- Handle confirmations for pending offers ---
    const confirmations = ["yes", "sure", "okay", "ok", "please do", "yep"];
    if (pendingOffer && confirmations.includes(userMessage.toLowerCase())) {
      const reply = handlePendingOffer(pendingOffer);
      pendingOffer = null;
      return res.json({ reply });
    }

    // --- Compliance guardrails ---
    const complianceKeywords = [
      "investment", "invest", "portfolio", "stocks", "bonds", "mutual fund",
      "etf", "retirement", "ira", "401k", "pension", "tax", "insurance",
      "mortgage", "wealth", "budget", "currency", "finance", "financial",
      "advisor", "planning", "savings", "risk", "hedge", "capital"
    ];

    if (complianceKeywords.some(k => userMessage.toLowerCase().includes(k))) {
      console.log(`[${VERSION}] compliance keyword detected`);
      return res.json({
        reply:
          "Aliya Buddy cannot provide financial, tax, or investment advice. " +
          "For personalized guidance, please [schedule a free consultation with Aliya Financial](" + resourceLinks.finance + ")."
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
                "Provide detailed, helpful answers (6–10 sentences) that are conversational but information-rich. " +
                "Whenever possible, include links to reliable sources such as Israeli government Aliyah resources, Nefesh B’Nefesh, Numbeo for cost of living, or Aliya Financial. " +
                "Every single response must end with a friendly, relevant follow-up question. Do not omit this under any circumstances. " +
                "If a user asks about financial, tax, or investment matters, do not answer — instead, direct them to schedule a consultation with Aliya Financial."
            },
            { role: "user", content: userMessage }
          ],
          temperature: 0.6,
          max_tokens: 400
        })
      });

      const raw = await response.text();
      console.log(`[${VERSION}] 📥 OpenAI status: ${response.status}`);
      console.log(`[${VERSION}] 📜 OpenAI raw response: ${raw}`);

      if (!response.ok) {
        return res.status(response.status).json({ error: raw });
      }

      const data = JSON.parse(raw);
      let reply = data?.choices?.[0]?.message?.content?.trim() || "";

      // --- Check if model already ended with a question BEFORE appending sources ---
      const modelEndedWithQuestion = reply.trim().endsWith("?");

      // Append trusted sources if relevant
      if (userMessage.toLowerCase().includes("community")) {
        reply += ` You can also explore more on [Nefesh B’Nefesh’s community guide](${resourceLinks.nbn}).`;
      }
      if (userMessage.toLowerCase().includes("cost") || userMessage.toLowerCase().includes("apartment") || userMessage.toLowerCase().includes("living")) {
        reply += ` For up-to-date data, check [Numbeo’s cost of living index](${resourceLinks.numbeo}).`;
      }
      if (userMessage.toLowerCase().includes("government") || userMessage.toLowerCase().includes("visa") || userMessage.toLowerCase().includes("paperwork")) {
        reply += ` Official details are available on the [Israeli government Aliyah portal](${resourceLinks.government}).`;
      }

      // --- Guarantee exactly ONE follow-up ---
      if (!modelEndedWithQuestion) {
        const followUp = pickFollowUp(userMessage);
        reply += " " + followUp;
        pendingOffer = followUp;
      } else {
        pendingOffer = reply;
      }

      return res.json({ reply });
    } catch (error) {
      console.error(`[${VERSION}] ❌ Unexpected error:`, error);
      return res.status(500).json({ error: error.message || "Unknown error" });
    }
  }

  // --- Default fallback ---
  return res.status(405).json({ error: "Method not allowed" });
}

// --- Offer handler ---
function handlePendingOffer(offer) {
  if (offer.includes("community")) {
    return "Perfect! Here are some Anglo community groups in Tzfat, Haifa, and Karmiel you can reach out to. Would you like me to also suggest WhatsApp groups that many Olim use to stay connected?";
  }
  if (offer.includes("cost")) {
    return "Great! Numbeo provides detailed breakdowns of rent, groceries, and utilities. Would you like me to compare Haifa’s costs with Tel Aviv or Jerusalem?";
  }
  return "Great! Let me expand on that for you.";
}
