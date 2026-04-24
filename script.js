const states = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California",
  "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida",
  "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana",
  "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah",
  "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const stateData = window.FOIA_STATE_DATA || {};
const residencyRequirementStates = new Set([
  "Alabama",
  "Arkansas",
  "Delaware",
  "Kentucky",
  "New Jersey",
  "Tennessee",
  "Virginia"
]);

const federalKeywords = /\b(FBI|EPA|DOD|DoD|HHS|FDA|CIA|NSA|IRS|DOJ|DHS|CDC|SEC|FTC|FEMA|SSA|ATF|USDA|DOT|VA|federal)\b/i;
const privateSectorKeywords = /\b(private business|corporate|corporation|company|employer|llc|inc\.?|ltd\.?|bank records?|vendor records?)\b/i;
const vagueRequestKeywords = /\b(all records|all emails|any and all|everything|all documents|all files|all correspondence)\b/i;
const exemptionPatterns = [
  { pattern: /\bmedical records?|health records?|patient records?\b/i, label: "medical records" },
  { pattern: /\bstudent records?|education records?|school records?\b/i, label: "student records" },
  { pattern: /\bpersonnel files?|personnel records?|employee files?\b/i, label: "personnel files" },
  { pattern: /\bsealed records?|sealed files?\b/i, label: "sealed records" },
  { pattern: /\bongoing investigation(s)?|active investigation(s)?|law enforcement investigation(s)?|criminal investigation(s)?\b/i, label: "ongoing investigations" }
];

const stepPanels = Array.from(document.querySelectorAll("[data-step]"));
const stepIndicators = Array.from(document.querySelectorAll("[data-step-indicator]"));
const nextButton = document.getElementById("next-step");
const prevButton = document.getElementById("prev-step");
const wizardCard = document.querySelector(".wizard-card");
const form = document.querySelector(".wizard-form");
const stateSelect = document.getElementById("state-select");
const stateInlineDetails = document.getElementById("state-inline-details");
const agencyAddressToggle = document.getElementById("agency-address-toggle");
const agencyAddressFields = document.getElementById("agency-address-fields");
const feeLimitField = document.getElementById("fee-limit-field");
const generationMessages = document.getElementById("generation-messages");
const letterPreview = document.querySelector(".letter-preview");
const letterText = document.getElementById("letter-text");
const editButton = document.getElementById("edit-letter");
const saveButton = document.getElementById("save-letter");
const newRequestButton = document.getElementById("new-request");
const printButton = document.getElementById("print-letter");
const copyButton = document.getElementById("copy-letter");
const downloadButton = document.getElementById("download-pdf");
const faqItems = Array.from(document.querySelectorAll(".faq-item"));
const tooltipTriggers = Array.from(document.querySelectorAll(".tooltip-trigger"));
const phoneInput = form.elements.requesterPhone;
const feeLimitInput = form.elements.feeLimit;
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-toggle-icon");
const STORAGE_KEY = "foia-form-progress";
const THEME_KEY = "foia-theme";

let currentStep = 1;
let generatedLetterPlainText = "Your generated letter will appear here.";
let generatedLetterTemplatePlainText = "";
let isLetterEditing = false;
let saveTimeout;

function renderStateOptions() {
  const fragment = document.createDocumentFragment();

  states.forEach((state) => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    fragment.appendChild(option);
  });

  stateSelect.appendChild(fragment);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function getSelectedFeePreference() {
  return form.elements.fee.value;
}

function updateFeeLimitVisibility() {
  feeLimitField.hidden = getSelectedFeePreference() !== "limit";
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Fail silently.
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Fail silently.
  }
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  if (themeIcon) {
    themeIcon.textContent = nextTheme === "light" ? "☾" : "☀";
  }
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", nextTheme === "light" ? "Toggle dark mode" : "Toggle light mode");
  }
}

function initTheme() {
  const savedTheme = safeStorageGet(THEME_KEY) || "dark";
  applyTheme(savedTheme);
}

function saveFormProgress() {
  const data = {
    state: stateSelect.value,
    agencyName: form.elements.agencyName.value,
    recordsDescription: form.elements.recordsDescription.value,
    format: form.elements.format.value,
    fee: form.elements.fee.value,
    feeLimit: form.elements.feeLimit.value,
    requesterName: form.elements.requesterName.value,
    requesterEmail: form.elements.requesterEmail.value,
    requesterPhone: form.elements.requesterPhone.value
  };

  if (form.elements.agencyStreet) data.agencyStreet = form.elements.agencyStreet.value;
  if (form.elements.agencyCity) data.agencyCity = form.elements.agencyCity.value;
  if (form.elements.agencyState) data.agencyState = form.elements.agencyState.value;
  if (form.elements.agencyZip) data.agencyZip = form.elements.agencyZip.value;
  if (form.elements.requesterStreet) data.requesterStreet = form.elements.requesterStreet.value;
  if (form.elements.requesterCity) data.requesterCity = form.elements.requesterCity.value;
  if (form.elements.requesterState) data.requesterState = form.elements.requesterState.value;
  if (form.elements.requesterZip) data.requesterZip = form.elements.requesterZip.value;
  if (form.elements.agencyAddress) data.agencyAddress = form.elements.agencyAddress.value;
  if (form.elements.requesterAddress) data.requesterAddress = form.elements.requesterAddress.value;

  safeStorageSet(STORAGE_KEY, JSON.stringify(data));
}

function debouncedSave() {
  window.clearTimeout(saveTimeout);
  saveTimeout = window.setTimeout(saveFormProgress, 500);
}

function restoreFormProgress() {
  const saved = safeStorageGet(STORAGE_KEY);
  if (!saved) {
    return;
  }

  try {
    const data = JSON.parse(saved);

    if (data.state) {
      stateSelect.value = data.state;
    }
    if (data.agencyName) form.elements.agencyName.value = data.agencyName;
    if (data.recordsDescription) form.elements.recordsDescription.value = data.recordsDescription;
    if (data.format) {
      const formatRadio = form.querySelector(`input[name="format"][value="${data.format}"]`);
      if (formatRadio) formatRadio.checked = true;
    }
    if (data.fee) {
      const feeRadio = form.querySelector(`input[name="fee"][value="${data.fee}"]`);
      if (feeRadio) feeRadio.checked = true;
    }
    if (data.feeLimit) form.elements.feeLimit.value = data.feeLimit;
    if (data.requesterName) form.elements.requesterName.value = data.requesterName;
    if (data.requesterEmail) form.elements.requesterEmail.value = data.requesterEmail;
    if (data.requesterPhone) form.elements.requesterPhone.value = data.requesterPhone;

    if (data.agencyStreet && form.elements.agencyStreet) form.elements.agencyStreet.value = data.agencyStreet;
    if (data.agencyCity && form.elements.agencyCity) form.elements.agencyCity.value = data.agencyCity;
    if (data.agencyState && form.elements.agencyState) form.elements.agencyState.value = data.agencyState;
    if (data.agencyZip && form.elements.agencyZip) form.elements.agencyZip.value = data.agencyZip;
    if (data.requesterStreet && form.elements.requesterStreet) form.elements.requesterStreet.value = data.requesterStreet;
    if (data.requesterCity && form.elements.requesterCity) form.elements.requesterCity.value = data.requesterCity;
    if (data.requesterState && form.elements.requesterState) form.elements.requesterState.value = data.requesterState;
    if (data.requesterZip && form.elements.requesterZip) form.elements.requesterZip.value = data.requesterZip;

    if (data.agencyAddress && form.elements.agencyAddress) form.elements.agencyAddress.value = data.agencyAddress;
    if (data.requesterAddress && form.elements.requesterAddress) form.elements.requesterAddress.value = data.requesterAddress;

    const hasAgencyAddress = Boolean(
      (data.agencyStreet && data.agencyStreet.trim()) ||
      (data.agencyCity && data.agencyCity.trim()) ||
      (data.agencyState && data.agencyState.trim()) ||
      (data.agencyZip && data.agencyZip.trim())
    );
    updateAgencyAddressVisibility(hasAgencyAddress);
    updateFeeLimitVisibility();
    updateInlineStateDetails();
  } catch {
    // Ignore corrupt saved state.
  }
}

function clearFormProgress() {
  window.clearTimeout(saveTimeout);
  safeStorageRemove(STORAGE_KEY);
}

function clearValidationErrors() {
  const existing = document.querySelector(".validation-errors");
  if (existing) {
    existing.remove();
  }
}

function validateStep(stepNumber) {
  const messages = [];

  if (stepNumber === 1 && !stateSelect.value) {
    messages.push("Please select a state to continue.");
  }

  if (stepNumber === 2) {
    const agencyName = form.elements.agencyName.value.trim();
    const description = form.elements.recordsDescription.value.trim();
    const requesterName = form.elements.requesterName.value.trim();
    const email = form.elements.requesterEmail.value.trim();

    if (!agencyName) messages.push("Agency name is required.");
    if (!description) messages.push("Please describe the records you are requesting.");
    if (!requesterName) messages.push("Your name is required.");
    if (!email) messages.push("Your email address is required.");
  }

  return messages;
}

function showValidationErrors(errors) {
  clearValidationErrors();

  const controls = document.querySelector(".wizard-controls");
  if (!controls || !errors.length) {
    return;
  }

  const div = document.createElement("div");
  div.className = "validation-errors";
  div.innerHTML = errors.map((error) => `<p>${escapeHTML(error)}</p>`).join("");
  controls.parentNode.insertBefore(div, controls);

  window.setTimeout(() => {
    if (div.parentNode) {
      div.remove();
    }
  }, 5000);
}

function getFormValues() {
  const description = form.elements.recordsDescription.value.trim();
  const agencyName = form.elements.agencyName.value.trim();
  const agencyStreet = form.elements.agencyStreet.value.trim();
  const agencyCity = form.elements.agencyCity.value.trim();
  const agencyState = form.elements.agencyState.value.trim().toUpperCase();
  const agencyZip = form.elements.agencyZip.value.trim();
  const agencyAddressLine1 = agencyStreet;
  const agencyAddressLine2Base = [agencyCity, agencyState].filter(Boolean).join(", ");
  const agencyAddressLine2 = [agencyAddressLine2Base, agencyZip].filter(Boolean).join(" ");
  const requesterName = form.elements.requesterName.value.trim();
  const requesterStreet = form.elements.requesterStreet.value.trim();
  const requesterCity = form.elements.requesterCity.value.trim();
  const requesterState = form.elements.requesterState.value.trim().toUpperCase();
  const requesterZip = form.elements.requesterZip.value.trim();
  const requesterAddressLine1 = requesterStreet;
  const requesterAddressLine2Base = [requesterCity, requesterState].filter(Boolean).join(", ");
  const requesterAddressLine2 = [requesterAddressLine2Base, requesterZip].filter(Boolean).join(" ");
  const requesterEmail = form.elements.requesterEmail.value.trim();
  const requesterPhone = form.elements.requesterPhone.value.trim();
  const feeLimit = form.elements.feeLimit.value.trim();

  return {
    state: stateSelect.value,
    description,
    agencyName,
    agencyStreet,
    agencyCity,
    agencyState,
    agencyZip,
    agencyAddressLine1,
    agencyAddressLine2,
    requesterName,
    requesterStreet,
    requesterCity,
    requesterState,
    requesterZip,
    requesterAddressLine1,
    requesterAddressLine2,
    requesterEmail,
    requesterPhone,
    format: form.elements.format.value,
    fee: getSelectedFeePreference(),
    feeLimit
  };
}

function buildDeadlineSentence(data) {
  if (data.deadlineSentence) {
    return data.deadlineSentence;
  }

  const deadline = String(data.responseDeadline || "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
  const directResponseMatch = deadline.match(/^(\d+\s+(?:business|calendar|working)\s+days?)\s+to\s+(.+?)(?:\.(.*))?$/i);

  if (directResponseMatch) {
    const timing = directResponseMatch[1];
    const action = directResponseMatch[2].replace(/\brequester\b/gi, "you");
    const remainder = directResponseMatch[3] ? ` ${directResponseMatch[3].trim()}` : "";
    return `Under the ${data.lawName}, your agency is required to ${action} within ${timing}.${remainder}`;
  }

  const mustRespondMatch = deadline.match(/^Must respond within\s+(.+)$/i);
  if (mustRespondMatch) {
    return `Under the ${data.lawName}, your agency is required to respond within ${mustRespondMatch[1].replace(/\.$/, "")}.`;
  }

  const mustAcknowledgeMatch = deadline.match(/^Must acknowledge within\s+(.+?)(?:\.\s*(.*))?$/i);
  if (mustAcknowledgeMatch) {
    const tail = mustAcknowledgeMatch[2] ? ` ${mustAcknowledgeMatch[2].trim()}` : "";
    return `Under the ${data.lawName}, your agency is required to acknowledge this request within ${mustAcknowledgeMatch[1].replace(/\.$/, "")}.${tail}`;
  }

  const agenciesMustAcknowledgeMatch = deadline.match(/^Agencies must acknowledge within\s+(.+)$/i);
  if (agenciesMustAcknowledgeMatch) {
    const rest = deadline.replace(/^Agencies must acknowledge within\s+[^.]+\.\s*/i, "");
    const tail = rest ? ` ${rest}` : "";
    return `Under the ${data.lawName}, your agency is required to acknowledge this request within ${agenciesMustAcknowledgeMatch[1].replace(/\.$/, "")}.${tail}`;
  }

  const numericStartMatch = deadline.match(/^(\d+\s+(?:business|calendar|working)\s+days?)\.\s*(.*)$/i);
  if (numericStartMatch) {
    const remainder = numericStartMatch[2] ? ` ${numericStartMatch[2].trim()}` : "";
    return `Under the ${data.lawName}, your agency is required to respond within ${numericStartMatch[1]}.${remainder}`;
  }

  return `Under the ${data.lawName}, your agency is required to follow the statutory response deadline: ${deadline}.`;
}

function cleanDeadlineForLetter(sentence) {
  let cleaned = String(sentence || "")
    .replace(/\s*May extend[^.]*\./gi, "")
    .replace(/\s*May invoke[^.]*\./gi, "")
    .replace(/\s*May request[^.]*extension[^.]*\./gi, "")
    .replace(/\s*One \d+-(?:business|calendar|working)-day extension[^.]*\./gi, "")
    .replace(/\s*Can extend[^.]*\./gi, "")
    .trim();

  cleaned = cleaned.replace(/'(unusual circumstances|good cause|reasonable time|promptly|reasonable|extraordinary circumstances)'/gi, "$1");

  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += ".";
  }

  return cleaned;
}

function buildMessageCard(type, title, body) {
  return `<article class="message-card ${type}"><strong>${escapeHTML(title)}</strong><p>${escapeHTML(body)}</p></article>`;
}

function detectExemptionWarnings(description) {
  const matches = exemptionPatterns
    .filter(({ pattern }) => pattern.test(description))
    .map(({ label }) => label);

  return Array.from(new Set(matches));
}

function renderMessages(messages) {
  generationMessages.innerHTML = messages.map((message) => buildMessageCard(message.type, message.title, message.body)).join("");
}

function buildEdgeCaseMessagesClean(values, data) {
  const messages = [];
  const agencyName = values.agencyName.trim();
  const description = values.description.trim();
  const stateHasResidencyRule = residencyRequirementStates.has(values.state);

  if (!agencyName || /^(i don't know|idk|unknown|not sure|unsure)$/i.test(agencyName)) {
    messages.push({
      type: "tip",
      title: "Don't know which agency?",
      body: "Not sure which agency to contact? Here are some common starting points: For police/crime records -> local police department or sheriff's office. For property/land records -> county assessor or recorder. For business licenses/permits -> city clerk or county clerk. For school records -> the school district's central office. For state-level records -> the relevant state department. You can also check your state's government directory for a complete list of agencies."
    });
  }

  if (!description || description.length < 20 || vagueRequestKeywords.test(description)) {
    messages.push({
      type: "tip",
      title: "Be more specific",
      body: "Tip: The more specific your request, the faster and more successful it's likely to be. Try to include specific date ranges, names, document types, or subject matter. For example, instead of 'all emails,' try 'emails between [Name] and [Name] between January and March 2026 regarding [topic].'"
    });
  }

  if (federalKeywords.test(description)) {
    messages.push({
      type: "error",
      title: "Federal records redirect",
      body: "This tool is designed for state and local public records requests. For federal FOIA requests (requests to agencies like the FBI, EPA, DOD, HHS, etc.), visit foia.gov - the federal government's official FOIA portal where you can submit requests directly to federal agencies."
    });
  }

  if (privateSectorKeywords.test(description)) {
    messages.push({
      type: "error",
      title: "Private-sector records",
      body: "Public records laws apply to government agencies, not private businesses. If you're looking for records from a company, consider: SEC EDGAR filings (for public companies), state business registration records (often available through the Secretary of State), or court records (if litigation is involved)."
    });
  }

  const exemptionCategories = detectExemptionWarnings(description);
  if (exemptionCategories.length) {
    messages.push({
      type: "warning",
      title: "Commonly exempt records warning",
      body: `Note: Some categories of records are commonly exempt from disclosure, including ${exemptionCategories.join(", ")}. Your request may be partially or fully denied on this basis. If it is denied, the agency must cite the specific legal exemption. See the resources panel for information about your state's appeals process.`
    });
  }

  if (stateHasResidencyRule) {
    messages.push({
      type: "warning",
      title: "Residency requirement warning",
      body: `Heads up: ${values.state} requires requesters to be a resident of the state (or meet other eligibility criteria). If you are not a ${values.state} resident, the agency may deny your request on that basis. Check the resources panel for details on your state's eligibility rules.`
    });
  }

  return messages;
}

function toSentenceCase(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function buildLetterData(values, data) {
  const deadlineSummary = cleanDeadlineForLetter(buildDeadlineSentence(data));
  const salutation = "Dear Records Custodian,";
  const selectedFormat = values.format === "paper"
    ? "Please provide the requested records in paper format, if available."
    : values.format === "electronic"
      ? "Please provide the requested records in electronic format, if available."
      : "I would prefer to inspect the records in person, if that is available under your procedures.";

  let feeParagraph = "";
  if (values.fee === "waiver") {
    feeParagraph = `I respectfully request a waiver of any applicable search, duplication, review, or processing fees to the extent permitted by law. If you believe fees will apply, please notify me in advance before incurring substantial charges.`;
  } else if (values.fee === "limit") {
    const limitText = values.feeLimit ? values.feeLimit : "[insert fee limit]";
    feeParagraph = `Please do not incur fees in excess of ${limitText} without contacting me first for approval. If the total estimated cost will exceed that amount, please let me know what records can be provided within my fee limit.`;
  } else {
    feeParagraph = `I am willing to pay reasonable fees as permitted by law. If the cost of fulfilling this request will be significant, please provide an itemized estimate before proceeding.`;
  }

  const closingContactParts = [];
  if (values.requesterEmail) {
    closingContactParts.push(values.requesterEmail);
  }
  if (values.requesterPhone) {
    closingContactParts.push(values.requesterPhone);
  }

  const contactLine = closingContactParts.length
    ? `If you have any questions or need clarification, please contact me at ${closingContactParts.join(" or ")}.`
    : "If you have any questions or need clarification, please contact me using the information below.";

  const bodyParagraphs = [
    `${data.sampleLetterOpening}`,
    values.description,
    selectedFormat,
    feeParagraph,
    `${deadlineSummary} If any portion of this request is delayed or denied, please provide the reason in writing and cite the specific exemption relied upon.`,
    contactLine
  ];

  const agencyAddressLines = [
    values.agencyName || "Agency Name",
    values.agencyAddressLine1 || "",
    values.agencyAddressLine2 || ""
  ].filter(Boolean);

  const requesterAddressLines = [
    values.requesterName || "Requester Name",
    values.requesterAddressLine1 || "",
    values.requesterAddressLine2 || ""
  ].filter(Boolean);

  const plainText = [
    formatToday(),
    "",
    "",
    agencyAddressLines.join("\n"),
    "",
    salutation,
    "",
    bodyParagraphs.join("\n\n"),
    "",
    "Sincerely,",
    "",
    requesterAddressLines.join("\n")
  ].join("\n");

  const html = `
    <div class="letter-sheet">
      <p class="letter-date">${escapeHTML(formatToday())}</p>
      <div class="letter-address">
        <p>${escapeHTML(values.agencyName || "Agency Name")}</p>
        ${values.agencyAddressLine1 ? `<p>${escapeHTML(values.agencyAddressLine1)}</p>` : ""}
        ${values.agencyAddressLine2 ? `<p>${escapeHTML(values.agencyAddressLine2)}</p>` : ""}
      </div>
      <p class="letter-salutation">${escapeHTML(salutation)}</p>
      <div class="letter-body">
        ${bodyParagraphs.map((paragraph) => `<p class="letter-paragraph">${escapeHTML(paragraph)}</p>`).join("")}
      </div>
      <p class="letter-closing">Sincerely,</p>
      <div class="letter-signature">
        <p>${escapeHTML(values.requesterName || "Requester Name")}</p>
        ${values.requesterAddressLine1 ? `<p>${escapeHTML(values.requesterAddressLine1)}</p>` : ""}
        ${values.requesterAddressLine2 ? `<p>${escapeHTML(values.requesterAddressLine2)}</p>` : ""}
      </div>
    </div>
  `;

  return { plainText, html };
}

function renderGeneratedLetter(values, data) {
  const { plainText, html } = buildLetterData(values, data);
  generatedLetterTemplatePlainText = plainText;
  generatedLetterPlainText = plainText;
  isLetterEditing = false;
  letterText.innerHTML = html;
  letterText.classList.remove("letter-preview-text");
  letterPreview.classList.remove("is-editing");
  editButton.hidden = false;
  saveButton.hidden = true;
  copyButton.disabled = false;
  downloadButton.disabled = false;
  if (printButton) {
    printButton.hidden = false;
    printButton.disabled = false;
  }
  if (newRequestButton) {
    newRequestButton.hidden = false;
  }
}

function getActiveLetterText() {
  if (isLetterEditing) {
    const editor = document.getElementById("letter-editor");
    if (editor) {
      return editor.value;
    }
  }

  return generatedLetterPlainText;
}

function renderEditableLetter(text) {
  letterPreview.classList.add("is-editing");
  letterText.classList.remove("formal-letter");
  letterText.classList.add("formal-letter", "letter-preview-text");
  letterText.innerHTML = `<textarea id="letter-editor" aria-label="Editable letter">${escapeHTML(text)}</textarea>`;
  editButton.hidden = true;
  saveButton.hidden = false;
  if (newRequestButton) {
    newRequestButton.hidden = false;
  }
  if (printButton) {
    printButton.hidden = false;
    printButton.disabled = false;
  }
}

function renderSavedEditedLetter(text) {
  letterPreview.classList.remove("is-editing");
  letterText.classList.remove("letter-preview-text");
  letterText.classList.add("formal-letter");
  letterText.innerHTML = `<div class="letter-preview-text">${escapeHTML(text).replace(/\n/g, "<br>")}</div>`;
  editButton.hidden = false;
  saveButton.hidden = true;
  if (newRequestButton) {
    newRequestButton.hidden = false;
  }
  if (printButton) {
    printButton.hidden = false;
  }
}

function enterEditMode() {
  isLetterEditing = true;
  renderEditableLetter(generatedLetterPlainText);
}

function saveLetterEdits() {
  const editor = document.getElementById("letter-editor");
  if (!editor) {
    return;
  }

  generatedLetterPlainText = editor.value;
  isLetterEditing = false;
  renderSavedEditedLetter(generatedLetterPlainText);
}

function formatPhoneNumber(value) {
  const digits = String(value).replace(/\D/g, "").slice(0, 10);
  if (digits.length > 0 && digits.length < 4) {
    return `(${digits}`;
  }
  if (digits.length >= 4 && digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}`;
  }
  if (digits.length >= 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return "";
}

function formatFeeLimitCurrency(value) {
  const raw = String(value).replace(/[^0-9.]/g, "");
  if (!raw) {
    return "";
  }

  const firstDot = raw.indexOf(".");
  let whole = raw;
  let decimal = "";

  if (firstDot !== -1) {
    whole = raw.slice(0, firstDot);
    decimal = raw.slice(firstDot + 1).replace(/\./g, "");
  }

  whole = whole.replace(/\./g, "");
  if (!whole) {
    whole = "0";
  }

  if (decimal) {
    decimal = decimal.slice(0, 2);
  }

  const numeric = `${whole}${decimal ? `.${decimal}` : ""}`;
  const parsed = Number(numeric);

  if (Number.isNaN(parsed)) {
    return "";
  }

  return `$${parsed.toFixed(2)}`;
}

function formatFeeLimitTyping(value) {
  const raw = String(value).replace(/[^0-9.]/g, "");
  if (!raw) {
    return "";
  }

  const firstDot = raw.indexOf(".");
  if (firstDot === -1) {
    return `$${raw}`;
  }

  const whole = raw.slice(0, firstDot).replace(/\./g, "") || "0";
  const decimal = raw.slice(firstDot + 1).replace(/\./g, "");
  return `$${whole}.${decimal.slice(0, 2)}`;
}

function buildStateChip(label, value) {
  return `
    <article class="state-chip">
      <div class="state-chip-label">${escapeHTML(label)}</div>
      <div class="state-chip-value">${escapeHTML(value || "")}</div>
    </article>
  `;
}

function getFirstSentence(text) {
  if (!text) {
    return "";
  }

  const cleaned = String(text).replace(/\s+/g, " ").trim();
  const sentenceMatch = cleaned.match(/^(.*?[.!?])(?:\s+[A-Z].*|$)/);

  if (sentenceMatch) {
    return sentenceMatch[1];
  }

  const fallbackMatch = cleaned.match(/^(.*?)(?:\.\s+[A-Z].*|\.?$)/);
  if (fallbackMatch) {
    return fallbackMatch[1].endsWith(".") ? fallbackMatch[1] : `${fallbackMatch[1]}.`;
  }

  return cleaned;
}

function updateInlineStateDetails() {
  const container = stateInlineDetails;
  const selected = stateSelect.value;

  if (!container) {
    return;
  }

  if (!selected || !stateData[selected]) {
    container.innerHTML = "";
    return;
  }

  const data = stateData[selected];
  const isResidency = residencyRequirementStates.has(selected);

  const deadlineShort = getFirstSentence(data.responseDeadline);
  const feesShort = getFirstSentence(data.fees);
  const appealsShort = getFirstSentence(data.appeals);

  const residencyHtml = isResidency
    ? `<div class="state-warning">Residency required - ${escapeHTML(selected)} limits requests to state residents or those who meet specific eligibility criteria.</div>`
    : "";

  const linksHtml = (data.resources || []).map((resource) => `
    <a href="${resource.url}" target="_blank" rel="noreferrer noopener">${escapeHTML(resource.label)}</a>
  `).join("");

  container.innerHTML = `
    <div class="state-inline-shell">
      <div class="state-chips">
        <div class="state-chip">
          <div class="state-chip-label">Law</div>
          <div class="state-chip-value">${escapeHTML(data.lawName)}</div>
        </div>
        <div class="state-chip">
          <div class="state-chip-label">Deadline</div>
          <div class="state-chip-value">${escapeHTML(deadlineShort)}</div>
        </div>
        <div class="state-chip">
          <div class="state-chip-label">Fees</div>
          <div class="state-chip-value">${escapeHTML(feesShort)}</div>
        </div>
        <div class="state-chip">
          <div class="state-chip-label">Appeals</div>
          <div class="state-chip-value">${escapeHTML(appealsShort)}</div>
        </div>
      </div>
      ${residencyHtml}
      <div class="state-resources-toggle" role="button" tabindex="0" aria-expanded="false">
        <span>View resources and links</span>
        <span class="toggle-icon" aria-hidden="true">+</span>
      </div>
      <div class="state-resources-list">
        ${linksHtml}
      </div>
    </div>
  `;
}

function setStep(step, { scroll = false } = {}) {
  currentStep = step;

  stepPanels.forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.step) === step);
  });

  stepIndicators.forEach((indicator) => {
    indicator.classList.toggle("active", Number(indicator.dataset.stepIndicator) === step);
  });

  prevButton.disabled = step === 1;
  nextButton.textContent = step === 3 ? "Generate Letter" : "Next";
  const hasGeneratedLetter = Boolean(generatedLetterPlainText && generatedLetterPlainText !== "Your generated letter will appear here.");

  if (newRequestButton) {
    newRequestButton.hidden = !(step === 3 && hasGeneratedLetter);
  }

  if (printButton) {
    printButton.hidden = !(step === 3 && hasGeneratedLetter);
    printButton.disabled = !hasGeneratedLetter;
  }

  if (scroll && wizardCard) {
    window.setTimeout(() => {
      wizardCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }
}

function updateAgencyAddressVisibility(forceOpen = null) {
  if (!agencyAddressFields || !agencyAddressToggle) {
    return;
  }

  const shouldOpen = forceOpen === null
    ? !agencyAddressFields.hidden
    : Boolean(forceOpen);

  agencyAddressFields.hidden = !shouldOpen;
  agencyAddressToggle.setAttribute("aria-expanded", String(shouldOpen));
  agencyAddressToggle.textContent = shouldOpen
    ? "Hide agency address"
    : "Add agency address (optional)";
}

function resetLetterPreview() {
  generatedLetterPlainText = "Your generated letter will appear here.";
  generatedLetterTemplatePlainText = "";
  isLetterEditing = false;
  letterText.innerHTML = '<p class="empty-state-note">Your generated letter will appear here.</p>';
  letterText.classList.remove("letter-preview-text");
  letterPreview.classList.remove("is-editing");
  generationMessages.innerHTML = "";
  if (editButton && saveButton) {
    editButton.hidden = false;
    saveButton.hidden = true;
  }
  if (newRequestButton) {
    newRequestButton.hidden = true;
  }
  if (printButton) {
    printButton.hidden = true;
    printButton.disabled = true;
  }
  copyButton.disabled = true;
  downloadButton.disabled = true;
}

function invalidateGeneratedLetter() {
  resetLetterPreview();
}

function handleGenerateLetter() {
  const values = getFormValues();
  const data = stateData[values.state];
  const messages = buildEdgeCaseMessagesClean(values, data);

  renderMessages(messages);

  const hasBlockingIssue = messages.some((message) => message.type === "error" && (
    message.title === "Federal records redirect" ||
    message.title === "Private-sector records"
  ));

  if (!data || hasBlockingIssue) {
    generatedLetterPlainText = "";
    letterText.innerHTML = `
      <p class="empty-state-note">Select a supported state and resolve any blocking issues before generating a letter.</p>
    `;
    copyButton.disabled = true;
    downloadButton.disabled = true;
    if (printButton) {
      printButton.disabled = true;
    }
    return;
  }

  renderGeneratedLetter(values, data);
}

stateSelect.addEventListener("change", () => {
  clearValidationErrors();
  updateInlineStateDetails();
  updateFeeLimitVisibility();
  resetLetterPreview();
});

if (agencyAddressToggle) {
  agencyAddressToggle.addEventListener("click", () => {
    if (!agencyAddressFields) {
      return;
    }

    const nextState = agencyAddressFields.hidden;
    updateAgencyAddressVisibility(nextState);
  });
}

if (newRequestButton) {
  newRequestButton.addEventListener("click", () => {
    form.reset();
    clearFormProgress();
    clearValidationErrors();
    updateAgencyAddressVisibility(false);
    updateFeeLimitVisibility();
    updateInlineStateDetails();
    resetLetterPreview();
    setStep(1, { scroll: true });
  });
}

if (printButton) {
  printButton.addEventListener("click", () => {
    if (printButton.disabled) {
      return;
    }
    window.print();
  });
}

phoneInput.addEventListener("input", () => {
  const formatted = formatPhoneNumber(phoneInput.value);
  if (phoneInput.value !== formatted) {
    phoneInput.value = formatted;
  }
});

feeLimitInput.addEventListener("input", () => {
  const formatted = formatFeeLimitTyping(feeLimitInput.value);
  if (feeLimitInput.value !== formatted) {
    feeLimitInput.value = formatted;
  }
});

feeLimitInput.addEventListener("blur", () => {
  const formatted = formatFeeLimitCurrency(feeLimitInput.value);
  if (feeLimitInput.value !== formatted) {
    feeLimitInput.value = formatted;
  }
});

form.addEventListener("change", (event) => {
  if (event.target && event.target.id === "letter-editor") {
    return;
  }
  clearValidationErrors();
  updateFeeLimitVisibility();
  debouncedSave();
  invalidateGeneratedLetter();
});

form.addEventListener("input", (event) => {
  if (event.target && event.target.id === "letter-editor") {
    return;
  }
  clearValidationErrors();
  updateFeeLimitVisibility();
  debouncedSave();
  invalidateGeneratedLetter();
});

nextButton.addEventListener("click", () => {
  clearValidationErrors();

  if (currentStep < 3) {
    const errors = validateStep(currentStep);
    if (errors.length) {
      showValidationErrors(errors);
      return;
    }

    setStep(currentStep + 1, { scroll: true });
    return;
  }

  handleGenerateLetter();
});

prevButton.addEventListener("click", () => {
  if (currentStep > 1) {
    clearValidationErrors();
    setStep(currentStep - 1, { scroll: true });
  }
});

faqItems.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) {
      return;
    }

    faqItems.forEach((otherItem) => {
      if (otherItem !== item) {
        otherItem.open = false;
      }
    });
  });
});

function closeTooltip(trigger) {
  trigger.classList.remove("is-open");
  trigger.setAttribute("aria-expanded", "false");
}

function openTooltip(trigger) {
  tooltipTriggers.forEach((otherTrigger) => {
    if (otherTrigger !== trigger) {
      closeTooltip(otherTrigger);
    }
  });

  trigger.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
}

tooltipTriggers.forEach((trigger) => {
  const show = () => openTooltip(trigger);
  const hide = () => closeTooltip(trigger);

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = trigger.classList.contains("is-open");
    if (isOpen) {
      hide();
    } else {
      show();
    }
  });

  trigger.addEventListener("mouseenter", show);
  trigger.addEventListener("mouseleave", hide);
});

document.addEventListener("click", () => {
  tooltipTriggers.forEach((trigger) => closeTooltip(trigger));
});

if (editButton && saveButton) {
  editButton.addEventListener("click", () => {
    if (generatedLetterPlainText === "Your generated letter will appear here.") {
      return;
    }

    enterEditMode();
  });

  saveButton.addEventListener("click", () => {
    saveLetterEdits();
  });
}

if (stateInlineDetails) {
  stateInlineDetails.addEventListener("click", (event) => {
    const toggle = event.target.closest(".state-resources-toggle");
    if (!toggle || !stateInlineDetails.contains(toggle)) {
      return;
    }

    const list = stateInlineDetails.querySelector(".state-resources-list");
    if (!list) {
      return;
    }

    const isOpen = list.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    const icon = toggle.querySelector(".toggle-icon");
    if (icon) {
      icon.textContent = isOpen ? "\u2212" : "+";
    }
  });
}

copyButton.addEventListener("click", async () => {
  try {
    const letterTextToCopy = getActiveLetterText();
    await navigator.clipboard.writeText(letterTextToCopy);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy to clipboard";
    }, 1500);
  } catch {
    copyButton.textContent = "Copy unavailable";
  }
});

if (themeToggle && themeIcon) {
  initTheme();

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    safeStorageSet(THEME_KEY, next);
  });
} else {
  initTheme();
}

downloadButton.addEventListener("click", () => {
  const { jsPDF } = window.jspdf || {};
  const letterContent = getActiveLetterText();

  if (!jsPDF || !letterContent || letterContent === "Your generated letter will appear here.") {
    downloadButton.textContent = "PDF unavailable";
    window.setTimeout(() => {
      downloadButton.textContent = "Download as PDF";
    }, 1500);
    return;
  }

  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  pdf.setFont("times", "normal");
  pdf.setFontSize(12);

  const marginX = 72;
  const marginTop = 72;
  const lineHeight = 18;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pdf.internal.pageSize.getWidth() - marginX * 2 - 10;
  const lines = letterContent.split("\n");

  let cursorY = marginTop;

  lines.forEach((line) => {
    if (line.trim() === "") {
      cursorY += lineHeight * 0.7;
      return;
    }

    const wrapped = pdf.splitTextToSize(line, maxWidth);
    wrapped.forEach((wrappedLine) => {
      if (cursorY > pageHeight - 72) {
        pdf.addPage();
        cursorY = marginTop;
      }

      pdf.text(wrappedLine, marginX, cursorY);
      cursorY += lineHeight;
    });
  });

  pdf.save("foia-request-letter.pdf");
});

renderStateOptions();
restoreFormProgress();
updateFeeLimitVisibility();
setStep(1);
updateInlineStateDetails();
resetLetterPreview();
tooltipTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  if (themeIcon) {
    themeIcon.textContent = nextTheme === "light" ? "☾" : "☀";
  }
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", nextTheme === "light" ? "Toggle dark mode" : "Toggle light mode");
  }
}
function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  if (themeIcon) {
    themeIcon.textContent = nextTheme === "light" ? "\u263e" : "\u2600";
  }
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", nextTheme === "light" ? "Toggle dark mode" : "Toggle light mode");
  }
}
