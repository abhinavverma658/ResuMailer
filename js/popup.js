document.addEventListener("DOMContentLoaded", () => {
  const fields = ["position", "smtpEmail", "smtpPassword"];
  const secretKey = "resumail_secret"; // You can customize this key

  // Load saved values
  chrome.storage.local.get(fields, (saved) => {
    fields.forEach((field) => {
      let value = saved[field];
      if (value) {
        if (field === "smtpPassword") {
          try {
            value = CryptoJS.AES.decrypt(value, secretKey).toString(CryptoJS.enc.Utf8);
          } catch (err) {
            console.error("Decryption error:", err);
          }
        }
        document.getElementById(field).value = value;
      }
    });
  });

  // Save on input
  fields.forEach((field) => {
    const el = document.getElementById(field);
    el.addEventListener("input", () => {
      let value = el.value;
      if (field === "smtpPassword") {
        value = CryptoJS.AES.encrypt(value, secretKey).toString();
      }
      chrome.storage.local.set({ [field]: value });
    });
  });
});
