document.addEventListener("DOMContentLoaded", async () => {
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
  const updateResumeStatus = async () => {
    const statusEl = document.getElementById("resumeStatus");
    const resumeHandle = await loadFileHandle("resume");
  
    if (resumeHandle) {
      statusEl.textContent = "✅ Resume is already saved in local storage.";
      statusEl.classList.remove("text-danger");
      statusEl.classList.add("text-success");
    } else {
      statusEl.textContent = "⚠️ No resume found in local storage. Please select a resume.";
      statusEl.classList.remove("text-success");
      statusEl.classList.add("text-danger");
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
    const successEl = document.getElementById("excelParseSuccess");
    const errorEl = document.getElementById("excelParseError");
  
    // Hide both messages
    successEl?.classList.add("d-none");
    errorEl?.classList.add("d-none");
  
    if (!excelHandle) return console.log("Excel handle not found.");
  
    const granted = await hasPermission(excelHandle);
    if (!granted) return console.log("Excel permission not granted.");
  
    try {
      const file = await excelHandle.getFile();
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  
      // ✅ Check for valid keys only
      const allowedFields = ["Email", "Company", "Message"];
      const hasInvalidField = rows.some(row => {
        const keys = Object.keys(row);
        return keys.some(key => !allowedFields.includes(key));
      });
  
      if (hasInvalidField) {
        console.warn("❌ Invalid columns detected in Excel.");
        errorEl?.classList.remove("d-none");
        setTimeout(() => errorEl?.classList.add("d-none"), 5000);
        return;
      }
  
      console.log("✅ Excel parsed successfully:", rows);
      chrome.storage.local.set({ parsedExcelRows: rows });
  
      successEl?.classList.remove("d-none");
      setTimeout(() => successEl?.classList.add("d-none"), 4000);
    } catch (err) {
      console.error("❌ Error parsing Excel:", err);
      errorEl?.classList.remove("d-none");
      setTimeout(() => errorEl?.classList.add("d-none"), 5000);
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
      return;
    }
  
    const resumeFile = await resumeHandle.getFile();
    const resumeBase64 = await fileToBase64(resumeFile);
  
    chrome.storage.local.get("parsedExcelRows", async ({ parsedExcelRows }) => {
      if (!parsedExcelRows || parsedExcelRows.length === 0) {
        alert("No data found in Excel file.");
        return;
      }
  
      const useExcel = elements.checkbox.checked;
      const defaultMessage = getEl("defaultMessage")?.value || "";
  
     chrome.runtime.sendMessage({
    type: "sendEmails",
    payload: {
      rows: parsedExcelRows,
      smtpEmail,
      smtpPassword,
      position,
      resume: {
        name: resumeFile.name,
        base64: resumeBase64,
      },
      useExcel,
      defaultMessage
    },
  },
  (response) => {
    if (chrome.runtime.lastError) {
      console.error("❌ Message error:", chrome.runtime.lastError.message);
      statusEl.style.color = "red";
      statusEl.textContent = "❌ Failed to connect to background script.";
      return;
    }

    if (response?.status === "done") {
      statusEl.style.color = "green";
      statusEl.textContent = "✅ All emails sent.";
    } else {
      statusEl.style.color = "red";
      statusEl.textContent = "❌ Failed to send some or all emails.";
    }
  }
);
chrome.runtime.sendMessage({ type: "ping" }, (response) => {
  if (chrome.runtime.lastError) {
    console.error("❌ Message error:", chrome.runtime.lastError.message);
  } else {
    console.log("✅ Background response:", response);
  }
});
 
    });
  });
  console.log("✅ Popup script loaded successfully.");  
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
      const res = await fetch("https://resumail-server.onrender.com/send-email", {
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "emailStatusUpdate") {
    const { toEmail, status, message } = request.payload;
    const statusEl = document.getElementById("statusMessage");
    if (!statusEl) return;

    statusEl.innerHTML += `<div style="color:${status === "sent" ? "green" : "red"}">
      ${status === "sent" ? "✅" : "❌"} ${toEmail} — ${message}
    </div>`;
  }
});
