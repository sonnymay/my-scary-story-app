require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { OpenAI } = require("openai");
const { VertexAI } = require('@google-cloud/vertexai');
const winston = require('winston');

// Configure Winston with better formatting
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve all static files (HTML, CSS, JS) from "public" folder
app.use(express.static("public"));

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Vertex AI with correct method
const vertexai = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1'
});

const model = vertexai.preview.getGenerativeModel({
  model: 'imagegeneration@005',
  generation_config: {
    temperature: 0.4,
  },
});

async function generateImage(prompt) {
  try {
    const request = {
      prompt: prompt,
    };
    
    const response = await model.generate_images(request);
    return response.images.map(image => ({
      url: `data:image/png;base64,${image.data}`
    }));
  } catch (error) {
    logger.error("Vertex AI Error:", error);
    throw error;
  }
}

/**
 * GET /api/story
 * - Generates a short scary story
 * - Generates an image (or multiple images) related to the story
 */
app.get("/api/story", async (req, res) => {
  try {
    // 1) Get location and ghost
    const locationPrompt = `
    You are a paranormal expert. 
    1) Suggest a well-known location (state in the US or a country) that is famous for its ghost stories.
    2) Identify a specific, well-known ghost or cryptid associated with that location.
    Format:
    Location: [Location Name]
    Entity: [Entity's Name]
    `;

    logger.info("Starting story generation process");
    logger.debug("Location Prompt:", locationPrompt);

    const locationResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: locationPrompt }],
      max_tokens: 100,
      temperature: 0.8,
    });

    logger.debug("Location Response Raw:", locationResponse);
    const locationData = locationResponse.choices[0].message.content.trim();
    logger.info("Location Data:", locationData);

    const locationMatch = locationData.match(/Location:\s*(.*)/i);
    const entityMatch = locationData.match(/Entity:\s*(.*)/i);
    
    if (!locationMatch || !entityMatch) {
      throw new Error("Failed to extract location or entity from response");
    }

    const location = locationMatch[1].trim();
    const entityName = entityMatch[1].trim();
    
    logger.info(`Location: ${location}, Entity: ${entityName}`);

    // 2) Generate story with specific format
    const storyPrompt = `
    You are a ghost story generator. Generate a short, scary ghost story about "${entityName}" in ${location}.
    The story should be under 150 words and follow this format:

    Example Story Format:
    "[Ghost/Entity Name]: [Catchy phrase or subtitle]!
    [Short introductory paragraph about the location and its reputation.]
    [Paragraph about the legend of the ghost/entity.]
    [Paragraph describing eerie encounters or sightings.]
    [Paragraph mentioning any unique or interesting details, like ghost cams.]
    [A question asking if the ghost/entity is still active.]
    [A question prompting the reader for their opinion on the story.]"

    Write a story in this format now.
    `;

    logger.info("Story Prompt:", storyPrompt);
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: storyPrompt }],
      max_tokens: 250,
      temperature: 0.8,
    });

    logger.debug("Chat Response:", chatResponse);

    const rawText = chatResponse.choices[0].message.content.trim();
    logger.debug("Story Raw Text:", rawText);

    // Check if we got valid story content
    if (!rawText) {
      throw new Error("Received empty story from OpenAI");
    }

    const titleMatch = rawText.match(/Title:\s*(.*)/i);
    const storyMatch = rawText.match(/Story:\s*([\s\S]*)/i);
    let storyTitle = titleMatch ? titleMatch[1].trim() : "";
    let storyBody = storyMatch ? storyMatch[1].trim() : "";

    // 3) Generate image with Vertex AI instead of OpenAI
    const imagePrompt = `Create a creepy scene of the ghost "${entityName}" in ${location}. ${storyBody.substring(0, 100)}`;
    logger.debug("Image Prompt:", imagePrompt);
    
    const imageURLs = await generateImage(imagePrompt);
    logger.debug("Image Response:", imageURLs);

    return res.json({
      storyTitle: `${entityName}: ${location}`,
      storyBody: rawText, // Use full raw text since format is in prompt
      images: imageURLs,
    });
  } catch (error) {
    logger.error("Error details:", {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });

    res.status(500).json({ 
      error: "Failed to generate story",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
