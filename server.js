const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();

const EXTENSION_ORIGIN = "chrome-extension://iobkboneibdcnodgpiafkekccdjjiikd";

// ✅ Set headers manually
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", EXTENSION_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ✅ Body parsing
app.use(express.json({ limit: "10mb" }));

// ✅ Email API
app.post("/send-email", async (req, res) => {
  const { from, to, subject, body, password, attachment, filename } = req.body;

  if (!from || !to || !subject || !body || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: from,
        pass: password,
      },
    });

    const mailOptions = {
      from,
      to,
      subject,
      html: body,
      attachments: attachment
        ? [{ filename, content: attachment, encoding: "base64" }]
        : [],
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email.",
      error: error.message,
    });
  }
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Nodemailer server is running.");
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
