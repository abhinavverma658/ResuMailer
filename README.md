# 📧 ResuMailer - Chrome Extension for Bulk Resume Emailing

ResuMailer is a Chrome Extension that eases the process of sending job application emails using Gmail SMTP. It reads recipient data from an Excel sheet, personalizes messages, attaches your resume, and sends emails—all from a user-friendly interface.

---

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=for-the-badge" />
  <img src="https://img.shields.io/badge/build-passing-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=for-the-badge" />
  <img src="https://img.shields.io/badge/made%20by-Abhinav%20Verma-blueviolet?style=for-the-badge" />
</p>

---

## 🚀 Features

- ✅ **Easy Resume Automation** via your Gmail App Password
- ✅ **No Cloud Storage** — credentials remain on your system only (AES encrypted with [CryptoJS](https://github.com/brix/crypto-js))
- ✅ **Excel Integration** with [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs) for bulk message & contact parsing
- ✅ **Supports PDF, DOC, DOCX resumes** with proper MIME handling (base64 encoded)
- ✅ **CORS-enabled Express backend** hosted on [Render](https://render.com/)
- ✅ **Works in Background** — email sending continues even after closing the extension popup
- ✅ **Excel-based messaging only**, with a fallback **default message feature** (coming soon in final release)
- ✅ **UI built with Bootstrap 5** for lightweight and clean user experience

---

## 🧰 Tech Stack

| Layer         | Tech Used                       |
| ------------- | ------------------------------- |
| Frontend      | HTML, CSS, Bootstrap, JS        |
| Backend       | Node.js, Express.js             |
| Excel Parsing | xlsx (SheetJS)                  |
| Email Sender  | Nodemailer + Gmail SMTP         |
| File Security | AES Encryption via CryptoJS     |
| Hosting       | Render (Express Server)         |
| File Storage  | IndexedDB (no external servers) |

---

## 🔐 Privacy First

Your Gmail credentials are never uploaded or sent to any server. Everything is processed locally, and app passwords are securely encrypted and stored using AES (CryptoJS).

> ⚠️ Make sure to generate a [Gmail App Password](https://support.google.com/accounts/answer/185833?hl=en) for SMTP usage. Regular Gmail passwords will not work.

---

## 📦 How It Works

1. Upload your resume file (PDF/DOC/DOCX)
2. Select an Excel file with `Email`, `Company`, and `Message` columns only
3. Authorize file access for reading (only once)
4. Enter your Gmail app email & password
5. Hit **Send** — Emails will be queued & sent, even after closing the popup.

---

## 📁 Excel Format

Ensure your `.xlsx` file has **exactly** the following column headers (case-sensitive):

| Email             | Company | Message                       |
| ----------------- | ------- | ----------------------------- |
| example@gmail.com | Google  | I'd love to join Google as... |

> ❗ Any additional or incorrect fields will result in a parsing error.

---

## 📹

- 🎥 Video Demo : [https://www.youtube.com/watch?v=tMMWDZ35ePo] (Demo)
- 📑 Full documentation : [https://docs.google.com/document/d/1PNhin-4SysJP7j89F0nAq8HZDFh8ebaXt4LHN6ee8rI/edit?tab=t.0](Guide)
- 🧠 Tutorial series on how the internals work

---

## ⚠️ Permissions Used

This extension uses:

- `storage` — to save form data locally
- `scripting` — to handle background tasks
- `host_permissions` — needed only for file access, not browsing
- `remote code` — required for backend communication only (Render API)

Each permission is used strictly within the extension and **never for tracking**.

---

## 📬 Public Release

The beta version is nearly ready!

---

## 🔗 Connect

Follow me on [LinkedIn](https://www.linkedin.com/in/abhinavverma658/) to stay updated as I release:

- Feature breakdowns
- Dev logs
- Behind-the-scenes posts

---

## Author: [Abhinav Verma]

## Version: 1.2.8

## Last Updated: 14-07-2025

## © 2025 Abhinav Verma. All Rights Reserved.

## This software is licensed under a custom proprietary license. No modification, redistribution or commercial use is permitted.
