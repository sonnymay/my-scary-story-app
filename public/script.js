// script.js

// We'll store the next "new story" time in localStorage so that every visitor sees a personal 24-hour cycle.
// If you want a SINGLE global story for all visitors, you'd handle that on the server side instead.

const storyElement = document.getElementById("story");
const imagesContainer = document.getElementById("images");
const countdownElement = document.getElementById("countdown");

// 24-hour offset in milliseconds
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function formatTime(ms) {
  // Convert ms to hh:mm:ss
  let totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  totalSeconds %= 3600;
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function updateCountdown() {
  const nextStoryTime = parseInt(localStorage.getItem("nextStoryTime"), 10);
  const now = Date.now();
  const diff = nextStoryTime - now;

  if (diff <= 0) {
    // Time to fetch a new story
    fetchNewStory();
  } else {
    countdownElement.textContent = formatTime(diff);
  }
}

async function fetchNewStory() {
  try {
    storyElement.textContent = "Fetching a new scary story...";
    imagesContainer.innerHTML = "";

    // Fetch from our server's /api/story endpoint
    const response = await fetch("/api/story");
    const data = await response.json();

    if (data.story) {
      storyElement.textContent = data.story;
      // Display images if available
      if (data.images && data.images.length > 0) {
        data.images.forEach((imgUrl) => {
          const img = document.createElement("img");
          img.src = imgUrl;
          imagesContainer.appendChild(img);
        });
      }
    } else {
      storyElement.textContent = "Failed to retrieve story.";
    }

    // Set next story time = now + 24 hours
    const newNextStoryTime = Date.now() + TWENTY_FOUR_HOURS;
    localStorage.setItem("nextStoryTime", newNextStoryTime.toString());
  } catch (error) {
    console.error("Error fetching story:", error);
    storyElement.textContent = "Error fetching story.";
  }
}

// Initialize
window.addEventListener("DOMContentLoaded", () => {
  // Check if nextStoryTime is already set
  let nextStoryTime = localStorage.getItem("nextStoryTime");
  if (!nextStoryTime) {
    // If it's not set, fetch a new story and set it
    fetchNewStory();
  } else {
    // If it's set, compare with current time
    const now = Date.now();
    if (parseInt(nextStoryTime, 10) <= now) {
      // Already past due, fetch a new story
      fetchNewStory();
    } else {
      // We already have a story saved. 
      // But in this minimal example, we don't keep the story in localStorage.
      // For simplicity, let's just fetch a new story if you want it immediately.
      // Or you could store the last story in localStorage if you want to see the same story until nextStoryTime.
      fetchNewStory();
    }
  }

  // Update countdown every second
  setInterval(updateCountdown, 1000);
});
