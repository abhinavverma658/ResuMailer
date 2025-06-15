// Resumail background.js - basic template for Chrome Extension MV3

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_EMAIL') {
    // Example: handle email sending logic here
    // You can use fetch to call an email API, or handle logic as needed
    // sendResponse({ status: 'success' });
  }
  // Add more message types as needed
  return true; // Required for async sendResponse
});

// Optional: handle extension install/update events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time install actions
  } else if (details.reason === 'update') {
    // Update actions
  }
});
