// ============================================================
//  SeeADoctor — AI WhatsApp Bot
//  Stack: Meta WhatsApp Cloud API + Claude AI
// ============================================================

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── In-memory session store (replace with Redis/DB in production) ──
const sessions = {};

// ── System prompt: the AI brain for SeeADoctor ──
const SYSTEM_PROMPT = `You are Dola, the friendly and professional AI health assistant for SeeADoctor (seeadoctor.ng) — a digital healthcare platform in Nigeria that connects patients with verified doctors, specialists, laboratory services, radiology centers, and home care services.

Your personality:
- Warm, empathetic, and professional
- Clear and simple language (avoid heavy medical jargon)
- Always reassuring — patients may be anxious
- Nigerian-aware (understand local context, mention Abuja where relevant)

Your capabilities:
1. ANSWER FAQs about SeeADoctor services
2. COLLECT patient details (name, phone, location, complaint)
3. BOOK APPOINTMENTS by collecting required info
4. SEND the list of available specialist doctors/services
5. ESCALATE to a human agent when needed

Services SeeADoctor offers:
- Specialist Doctor Consultations (Cardiologist, Dermatologist, General Practitioner, Paediatrician, Gynaecologist, ENT, Orthopaedic, Neurologist, and more)
- Home Care Services (nurses and doctors visit at home)
- Laboratory Tests & Sample Collection (home collection available)
- Radiology Services (X-rays, Ultrasound, CT Scan, MRI)
- Telemedicine (online video/phone consultations)
- Ambulance & Emergency Services
- Medical Tourism coordination

Pricing:
- General GP Consultation: ₦5,000 – ₦10,000
- Specialist Consultation: ₦15,000 – ₦50,000 (depends on specialty)
- Home Care Visit: from ₦20,000
- Lab Tests: vary by test (patient can request a quote)
- Telemedicine: from ₦5,000

Location: Primarily serving Abuja, with expansion across Nigeria.
Website: seeadoctor.ng
Email: support@seeadoctor.ng
Emergency line: Share this only when patient mentions emergency.

Booking flow — when a patient wants to book, collect IN ORDER:
1. Full name
2. Phone number (if different from WhatsApp)
3. Location / Area in Abuja (or city)
4. Type of service needed (consultation, lab, home care, etc.)
5. Preferred date and time
6. Brief description of their health concern

Once all 6 details are collected, confirm the booking summary and tell them:
"Your request has been received! Our team will call you within 30 minutes to confirm your appointment. You can also visit seeadoctor.ng to book directly."

Human escalation: If a patient:
- Mentions an EMERGENCY (chest pain, difficulty breathing, accident, etc.) → immediately say: "Please call emergency services or go to the nearest hospital NOW. You can also reach our emergency line. Do not wait."
- Is very distressed or in severe pain → show empathy and escalate
- Asks something outside your knowledge → say "Let me connect you to one of our team members who can help better" and tell them a human agent will respond shortly
- Explicitly asks to speak to a human → escalate immediately

IMPORTANT RULES:
- Never diagnose a patient or prescribe medication
- Never give specific medical advice beyond general health information
- Always recommend the patient see a doctor for any medical concern
- Keep responses concise — WhatsApp is a messaging app, not an essay platform
- Use line breaks and emojis sparingly to keep messages readable on mobile
- Always end with a helpful next step or question to keep the conversation moving`;

// ── Conversation history manager ──
function getSession(phoneNumber) {
  if (!sessions[phoneNumber]) {
    sessions[phoneNumber] = {
      messages: [],
      bookingData: {},
      lastActive: Date.now(),
    };
  }
  sessions[phoneNumber].lastActive = Date.now();
  return sessions[phoneNumber];
}

// Clean up sessions older than 2 hours
setInterval(() => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  for (const [phone, session] of Object.entries(sessions)) {
    if (Date.now() - session.lastActive > TWO_HOURS) {
      delete sessions[phone];
    }
  }
}, 30 * 60 * 1000);

// ── Call Claude AI ──
async function getAIResponse(phoneNumber, userMessage) {
  const session = getSession(phoneNumber);

  // Add user message to history
  session.messages.push({ role: "user", content: userMessage });

  // Keep last 20 messages to avoid token overflow
  const recentMessages = session.messages.slice(-20);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: recentMessages,
    });

    const aiReply = response.content[0].text;

    // Save assistant reply to history
    session.messages.push({ role: "assistant", content: aiReply });

    return aiReply;
  } catch (error) {
    console.error("Claude API error:", error.message);
    return "Sorry, I'm having a technical issue right now. Please try again in a moment or contact us directly at support@seeadoctor.ng 🙏";
  }
}

// ── Send WhatsApp message via Meta Cloud API ──
async function sendWhatsAppMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`✅ Message sent to ${to}`);
  } catch (error) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
  }
}

// ── Send welcome message for new conversations ──
function isNewUser(phoneNumber) {
  return !sessions[phoneNumber] || sessions[phoneNumber].messages.length === 0;
}

// ── Webhook verification (Meta requires this) ──
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    console.warn("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ── Incoming message handler ──
app.post("/webhook", async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    const from = msg.from; // patient's phone number
    const msgType = msg.type;

    // Only handle text messages for now
    if (msgType !== "text") {
      await sendWhatsAppMessage(
        from,
        "Hi! I can currently only read text messages. Please type your question and I'll be happy to help 😊"
      );
      return;
    }

    const userText = msg.text.body.trim();
    console.log(`📩 Message from ${from}: ${userText}`);

    // Send welcome message to new users
    if (isNewUser(from)) {
      const welcome = `👋 Welcome to *SeeADoctor*!

I'm *Dola*, your AI health assistant. I'm here to help you:

🩺 Find the right doctor or specialist
📅 Book an appointment
🏠 Arrange home care or lab tests
❓ Answer any questions about our services

How can I help you today?`;
      getSession(from); // initialize session
      await sendWhatsAppMessage(from, welcome);

      // Small delay then process their first message if it wasn't just "hi"
      const greetings = ["hi", "hello", "hey", "helo", "hii", "good morning", "good afternoon", "good evening", "start"];
      if (!greetings.includes(userText.toLowerCase())) {
        const aiReply = await getAIResponse(from, userText);
        await sendWhatsAppMessage(from, aiReply);
      }
      return;
    }

    // Get AI response
    const aiReply = await getAIResponse(from, userText);
    await sendWhatsAppMessage(from, aiReply);

  } catch (error) {
    console.error("Webhook handler error:", error.message);
  }
});

// ── Health check endpoint ──
app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: "SeeADoctor WhatsApp AI Bot",
    timestamp: new Date().toISOString(),
  });
});

// ── Start server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SeeADoctor WhatsApp Bot running on port ${PORT}`);
});
