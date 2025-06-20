document.addEventListener("DOMContentLoaded", async () => {
  async function sendEmailViaServer({ from, to, subject, message, password, file, filename }) {
    const base64 = await fileToBase64(file);
  
    const res = await fetch("http://localhost:3000/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject,
        body: message,
        password,
        attachment: base64,
        filename,
      }),
    });
  
    const result = await res.json();
    return result;
  }  
  const fields = ["position", "smtpEmail", "smtpPassword", "defaultMessage", "resumeFilePath", "excelFilePath"];
  const getEl = id => document.getElementById(id);
  const secretKey = "resumail_secret";
  const elements = {
    checkbox: getEl("useExcelMessage"),
    defaultMessageWrapper: getEl("defaultMessageWrapper"),
    resumeFilePath: getEl("resumeFilePath"),
    excelFilePath: getEl("excelFilePath"),
    selectResumeBtn: getEl("selectResumeBtn"),
    selectExcelBtn: getEl("selectExcelBtn"),
    permissionBtn: getEl("requestFilePermissions"),
    sendBtn: getEl("sendBtn"),
  };

  chrome.storage.local.get(fields, (saved) => {
    fields.forEach((field) => {
      const el = getEl(field);
      if (!el || !saved[field]) return;
      let value = saved[field];
      if (field === "smtpPassword") {
        try {
          value = CryptoJS.AES.decrypt(value, secretKey).toString(CryptoJS.enc.Utf8);
        } catch (err) {
          console.error("Decryption error:", err);
          return;
        }
      }
      el.value = value;
    });
  });

  fields.forEach((field) => {
    const el = getEl(field);
    el?.addEventListener("input", () => {
      const value = field === "smtpPassword"
        ? CryptoJS.AES.encrypt(el.value, secretKey).toString()
        : el.value;
      chrome.storage.local.set({ [field]: value });
    });
  });

  const toggleMessageVisibility = (useExcel) => {
    if (elements.defaultMessageWrapper)
      elements.defaultMessageWrapper.style.display = useExcel ? "none" : "block";
  };

  if (elements.checkbox) {
    toggleMessageVisibility(elements.checkbox.checked);
    elements.checkbox.addEventListener("change", e =>
      toggleMessageVisibility(e.target.checked)
    );
  }

  const pickFile = async (type, fileTypes, pathFieldId) => {
    try {
      const [handle] = await window.showOpenFilePicker({ types: [fileTypes] });
      if (handle) {
        await saveFileHandle(type, handle);
        const inputField = getEl(pathFieldId);
        if (inputField) {
          inputField.value = handle.name;
          chrome.storage.local.set({ [pathFieldId]: handle.name });
        }
      }
    } catch (err) {
      console.log("File selection cancelled or failed:", err);
    }
  };

  elements.selectResumeBtn?.addEventListener("click", () =>
    pickFile("resume", {
      description: "Resume Files",
      accept: { "application/pdf": [".pdf"], "application/msword": [".doc", ".docx"] }
    }, "resumeFilePath")
  );

  elements.selectExcelBtn?.addEventListener("click", () =>
    pickFile("excel", {
      description: "Excel Files",
      accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
    }, "excelFilePath")
  );

  const tryParseExcelIfPermitted = async () => {
    const excelHandle = await loadFileHandle("excel");
    if (!excelHandle) return console.log("Excel handle not found.");

    const granted = await hasPermission(excelHandle);
    if (!granted) return console.log("Excel permission not granted.");

    try {
      const file = await excelHandle.getFile();
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      console.log("✅ Excel parsed successfully:", rows);
      chrome.storage.local.set({ parsedExcelRows: rows });
    } catch (err) {
      console.error("❌ Error parsing Excel:", err);
    }
  };

  for (const type of ["resume", "excel"]) {
    const inputId = type + "FilePath";
    const inputField = getEl(inputId);
    const handle = await loadFileHandle(type);

    if (handle) {
      inputField.value = handle.name || "";
      chrome.storage.local.set({ [inputId]: handle.name });

      if (type === "excel" && await hasPermission(handle)) {
        await tryParseExcelIfPermitted();
      }
    } else {
      inputField.value = "";
      chrome.storage.local.remove(inputId);
    }
  }

  if (elements.permissionBtn) {
    elements.permissionBtn.addEventListener("click", async () => {
      for (const type of ["resume", "excel"]) {
        const handle = await loadFileHandle(type);
        if (!handle) {
          alert(`No ${type} file handle found. Please select it first.`);
          continue;
        }

        try {
          const result = await handle.requestPermission({ mode: "read" });
          if (result === "granted") {
            alert(`${type} permission granted.`);
            if (type === "excel") await tryParseExcelIfPermitted();
          } else if (result === "denied") {
            alert(`${type} permission denied.`);
          } else {
            alert(`${type} permission prompt dismissed or unknown result.`);
          }
        } catch (err) {
          alert(`Error requesting permission for ${type}: ${err.message}`);
        }
      }
    });
  }

  elements.sendBtn?.addEventListener("click", async () => {
    console.log("✅ Send button clicked");
    
    const smtpEmail = getEl("smtpEmail").value;
    const smtpPassword = getEl("smtpPassword").value;
    const position = getEl("position").value;
    const statusEl = document.getElementById("statusMessage");
    statusEl.style.color = "black";
    statusEl.textContent = "Preparing to send...";
  
    const resumeHandle = await loadFileHandle("resume");
    if (!resumeHandle || !(await hasPermission(resumeHandle))) {
      alert("Resume file not accessible.");
      console.log("❌ Resume not accessible");
      return;
    }
  
    console.log("📄 Resume loaded");
  
    const resumeFile = await resumeHandle.getFile();
    chrome.storage.local.get("parsedExcelRows", async ({ parsedExcelRows }) => {
      console.log("📊 Fetched parsedExcelRows:", parsedExcelRows);
  
      if (!parsedExcelRows || parsedExcelRows.length === 0) {
        alert("No data found in Excel file.");
        return;
      }
  
      for (const [index, row] of parsedExcelRows.entries()) {
        const toEmail = row.Email?.trim();
        const companyName = row.Company?.trim() || "Company";
      
        if (!toEmail) {
          console.warn(`⚠️ Row ${index + 1} skipped — no email found.`);
          continue;
        }
      
        const finalBody = getFinalMessage(row, position, companyName);
        const emailPayload = {
          from: smtpEmail,
          to: toEmail,
          subject: `Application for ${position}`,
          message: finalBody,
          password: smtpPassword,
          file: resumeFile,
          filename: resumeFile.name,
        };
      
        console.log(`📤 [${index + 1}] Sending email to: ${toEmail}`);
        console.log("📦 Payload:", {
          from: smtpEmail,
          to: toEmail,
          subject: `Application for ${position}`,
          filename: resumeFile.name,
          previewMessage: finalBody.slice(0, 100) + (finalBody.length > 100 ? "..." : "")
        });
      
        try {
          const result = await sendEmailViaServer(emailPayload);
          console.log("📨 Server response:", result);
      
          if (result.success) {
            statusEl.style.color = "green";
            statusEl.textContent = `✅ Email sent to ${toEmail}`;
          } else {
            throw new Error(result.message);
          }
        } catch (err) {
          console.error(`❌ Failed to send to ${toEmail}:`, err);
          statusEl.style.color = "red";
          statusEl.textContent = `❌ Error sending to ${toEmail}: ${err.message}`;
        }
      }
      console.log("✅ All emails processed.");      
    });
  });  
});

function getFinalMessage(row, position, company) {
  const useExcelMessage = document.getElementById("useExcelMessage")?.checked;
  const defaultMessage = document.getElementById("defaultMessage")?.value || "";
  return (useExcelMessage && row.message)
    ? row.message
    : defaultMessage
        .replaceAll("{{position}}", position)
        .replaceAll("{{company}}", company);
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sendWithRetry(payload, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch("http://localhost:3000/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) return { success: true };
      if (attempt > retries) return { success: false, error: result.message };
    } catch (err) {
      if (attempt > retries) return { success: false, error: err.message };
    }
  }
}

const openHandleDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open("fileHandlesDB", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("handles");
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const saveFileHandle = async (key, handle) => {
  const db = await openHandleDB();
  const tx = db.transaction("handles", "readwrite");
  tx.objectStore("handles").put(handle, key);
  tx.oncomplete = () => db.close();
};

const loadFileHandle = async (key) => {
  const db = await openHandleDB();
  const tx = db.transaction("handles", "readonly");
  return new Promise((resolve) => {
    const req = tx.objectStore("handles").get(key);
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      resolve(null);
    };
  });
};

const hasPermission = async (handle) => {
  if (!handle) return false;
  const opts = { mode: 'read' };
  let perm = await handle.queryPermission?.(opts);
  return perm === 'granted';
};
chrome.storage.local.get("parsedExcelRows", console.log);