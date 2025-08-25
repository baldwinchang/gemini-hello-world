# gemini-hello-world

Good introduction to the latest ~2 years of high-tech trends (2023-2025). Key objectives and learnings:

1. Get familiar with LLMs and its associated bundle of advancements in AI, NLP, and information retrieval.
2. Familiarize with frontend interaction patterns central to powering chatbot-style query-response.
3. Understand how to embed grounding and citations (via footnotes)
4. Utilize Google's Gemini API to create a prompt, query, and render a response.
5. Have fun with a practical example which is why I call it "hello world" for Chatbot LLM.
6. Play around with "vibe coding"/"code assistant" tooling that can help bootstrap or simplify meticulous tasks that require a ton of research or labor.

## App

Simple search query that responds similar to a Google search powered by Gemini with sources. Other features added include stateful UI, session history, line breaks, and citations.

Provided as-is. Please use for your own educational purposes.

![Screenshot_24-8-2025_212229_gemini-mini-828139998860 us-west1 run app](https://github.com/user-attachments/assets/2f3be054-8e05-414f-b6f6-ef6da2048a3d)

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/14Um7O9HiJok5I3ZeZJDlAyMy4hrUBz0O

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
