require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// Serve all static files (HTML, CSS, JS) from "public" folder
app.use(express.static("public"));

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * GET /api/story
 * - Generates a short scary story
 * - Generates an image (or multiple images) related to the story
 */
app.get("/api/story", async (req, res) => {
  try {
    // 1) Generate a short scary story using Chat Completion
    const storyPrompt = `
    You are a story generator. 
    1) Produce a short scary story in 100 words or less.
    2) Produce a short, compelling title for the story.
    Return it in the format:
    Title: [title here]
    Story: [story here]
    `;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: storyPrompt }],
      max_tokens: 150,
      temperature: 0.8,
    });

    const rawText = chatResponse.choices[0].message.content.trim();
    const titleMatch = rawText.match(/Title:\s*(.*)/i);
    const storyMatch = rawText.match(/Story:\s*([\s\S]*)/i);
    let storyTitle = titleMatch ? titleMatch[1].trim() : "";
    let storyBody = storyMatch ? storyMatch[1].trim() : "";

    // 2) Generate 1 or 2 images based on the story
    //    We'll just pick some keywords or a short prompt from the story.
    //    Alternatively, you can craft your own image prompt logic.
    const imagePrompt = `
    Create a creepy, atmospheric illustration for a story titled "${storyTitle}".
    Key details: ${storyBody.substring(0, 100)}
    `.replace(/\n/g, " ");
    const imageResponse = await openai.images.generate({
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024", // Larger image
      model: "dall-e-3", // optional if you have access
      style: "vivid",    // optional style for more vivid images
    });

    const imageURLs = imageResponse.data.map((img) => img.url);

    return res.json({
      storyTitle,
      storyBody,
      images: imageURLs,
    });
  } catch (error) {
    console.error("Error generating story or images:", error);
    res.status(500).json({ error: "Failed to generate story." });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
