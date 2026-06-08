# SeeADoctor WhatsApp AI Bot — Complete Setup Guide

## What You're Building
A WhatsApp number that automatically replies to patients using Claude AI.
Patients message → AI (Dola) replies → books appointments, answers questions, escalates to human.

---

## STEP 1 — Get a Meta Developer Account & WhatsApp Access

1. Go to **https://developers.facebook.com**
2. Click **"Get Started"** and log in with your Facebook account
3. Click **"Create App"**
   - Select **"Business"** as the app type
   - App name: `SeeADoctor`
   - Click **"Create App"**

4. On your app dashboard, find **"WhatsApp"** and click **"Set Up"**
5. You'll land on the WhatsApp Getting Started page
6. Click **"Add phone number"** — follow the steps to verify your SeeADoctor business WhatsApp number

> 💡 You need a **WhatsApp Business Account** (WABA). If you don't have one, Meta will walk you through creating it.

---

## STEP 2 — Get Your API Credentials

From your Meta App Dashboard → WhatsApp → API Setup:

| Credential | Where to find it |
|---|---|
| **Phone Number ID** | Shown on the API Setup page |
| **WhatsApp Business Account ID** | Same page |
| **Temporary Access Token** | Same page (expires in 24hrs — see below for permanent) |

### Get a Permanent Access Token:
1. Go to **Meta Business Settings** → **System Users**
2. Create a System User → assign it to your App with **Admin** role
3. Click **"Generate Token"** → select your app → grant `whatsapp_business_messaging` permission
4. Copy this token — it doesn't expire

---

## STEP 3 — Get Your Anthropic (Claude) API Key

1. Go to **https://console.anthropic.com**
2. Sign up / log in
3. Click **"API Keys"** → **"Create Key"**
4. Copy it — you only see it once!

> 💡 Add a credit card and load at least $5. Claude is very cheap — 1,000 WhatsApp conversations cost roughly $1–2.

---

## STEP 4 — Deploy to Railway (Free Hosting)

Railway lets you host this bot for free. No coding needed for deployment.

1. Go to **https://railway.app** and sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
   - Upload the project files to a new GitHub repo first (see below)
3. Railway will detect it's a Node.js app and deploy automatically
4. Go to **Settings** → **"Generate Domain"** — you'll get a URL like:
   `https://seeadoctor-bot.up.railway.app`

### Upload to GitHub:
1. Go to **https://github.com** → **New Repository** → name it `seeadoctor-whatsapp-bot`
2. Upload the 3 files: `index.js`, `package.json`, `.env.example`
3. **IMPORTANT**: Rename `.env.example` to `.env` and fill in your real values BEFORE uploading
   OR use Railway's Environment Variables panel (more secure — see Step 5)

---

## STEP 5 — Set Environment Variables in Railway

In Railway dashboard → your project → **"Variables"** tab, add:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-permanent-token
WEBHOOK_VERIFY_TOKEN=seeadoctor_secret_2024
PORT=3000
```

> 🔒 Never put real keys inside GitHub — always use Railway's Variables panel.

---

## STEP 6 — Connect Webhook to Meta

This tells Meta where to send incoming WhatsApp messages.

1. Go to Meta App Dashboard → **WhatsApp** → **Configuration**
2. Under **Webhook**, click **"Edit"**
3. **Callback URL**: `https://your-railway-url.up.railway.app/webhook`
4. **Verify Token**: The same value you set for `WEBHOOK_VERIFY_TOKEN` (e.g. `seeadoctor_secret_2024`)
5. Click **"Verify and Save"**
6. Under **Webhook Fields**, subscribe to: `messages`

> ✅ If verification succeeds, you'll see a green checkmark. Your bot is live!

---

## STEP 7 — Test It

1. Open WhatsApp on your phone
2. Send a message to your SeeADoctor business number
3. You should get a reply from **Dola** within 5–10 seconds!

### Test messages to try:
- "Hi"
- "I need to see a cardiologist"
- "How much does a consultation cost?"
- "I want to book an appointment"
- "What services do you offer?"
- "I have chest pain" ← triggers emergency escalation

---

## STEP 8 — Going Live (Important)

By default, your bot only works with numbers you've verified in the Meta sandbox.
To make it work for ALL patients:

1. Meta App Dashboard → **App Review**
2. Request permission for: `whatsapp_business_messaging`
3. Submit your app for review (Meta reviews in 1–5 business days)
4. Once approved → change App Mode from **Development** to **Live**

---

## Human Agent Escalation

When the AI detects an emergency or a patient asks for a human, it tells the patient a human will respond. To actually route this:

**Option A (Simple):** The AI says "our team will call you" — you monitor WhatsApp Business app manually and jump in.

**Option B (Better):** Connect **Respond.io** or **Freshdesk** as your inbox — they can receive the handoff from the bot and assign to a human agent.

---

## Costs Summary

| Service | Cost |
|---|---|
| Meta WhatsApp API | Free for first 1,000 conversations/month, then ~$0.05 each |
| Claude API (Anthropic) | ~$0.001–0.003 per conversation |
| Railway hosting | Free tier available (or $5/month for always-on) |
| **Total for 500 patients/month** | **~$0–10** |

---

## Files in This Project

| File | Purpose |
|---|---|
| `index.js` | The main bot — handles messages, calls Claude, sends replies |
| `package.json` | Lists the libraries needed |
| `.env.example` | Template for your secret keys |
| `SETUP_GUIDE.md` | This file |

---

## Need Help?

If you get stuck on any step, the most common issues are:
- **Webhook not verifying** → check your `WEBHOOK_VERIFY_TOKEN` matches exactly
- **Messages not sending** → check your `WHATSAPP_ACCESS_TOKEN` hasn't expired
- **Bot not responding** → check Railway logs for errors

Contact your developer or reach out at support@seeadoctor.ng
