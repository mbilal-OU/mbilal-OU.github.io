import "./learning-depth.js?rc=depth4";

const DEPLOY_MARKER = "depth4-2026-08-27";
const LONG_FORM_NAME = "Simulation-Augmented Interactive Learning for High-Performance Computing";
const EXAM_NAME = "SAIL-HPC Practical Readiness Examination";
const EXAM_KEY = "sail-hpc-practical-readiness-exam-v1";

const printButton = document.getElementById("print-certificate");
const downloadButton = document.getElementById("download-certificate");

if (printButton) {
  printButton.addEventListener("click", (event) => {
    if (printButton.disabled || readinessScore() !== 100) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const data = certificateData();
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      setStatus("The browser blocked the print window. Allow pop-ups or use Download SVG.", "error");
      return;
    }

    const svg = certificateSVG(data);
    win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeXML(data.id)}</title><style>html,body{margin:0;background:#ddd}svg{display:block;width:100%;height:auto}@media print{body{background:white}}</style></head><body>${svg}<script>addEventListener('load',()=>print())<\/script></body></html>`);
    win.document.close();
  }, true);
}

if (downloadButton) {
  downloadButton.addEventListener("click", (event) => {
    if (downloadButton.disabled || readinessScore() !== 100) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = certificateData();
    const blob = new Blob([certificateSVG(data)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SAIL-HPC-${safeFileName(data.name)}-certificate.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Certificate SVG downloaded.", "ok");
  }, true);
}

function certificateData() {
  return {
    name: value("certificate-name") || "SAIL-HPC learner",
    affiliation: value("certificate-affiliation") || "Independent learner",
    country: value("certificate-country"),
    date: text("certificate-date-preview") || new Date().toISOString().slice(0, 10),
    id: text("certificate-id-preview") || "Local certificate ID",
  };
}

function certificateSVG(data) {
  const name = escapeXML(data.name);
  const affiliation = escapeXML(data.affiliation);
  const country = escapeXML(data.country);
  const date = escapeXML(data.date);
  const id = escapeXML(data.id);
  const affiliationLine = country ? `${affiliation} · ${country}` : affiliation;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100">
  <rect width="1600" height="1100" fill="#f7f4ee"/>
  <rect x="45" y="45" width="1510" height="1010" rx="18" fill="none" stroke="#d78c31" stroke-width="4"/>
  <rect x="62" y="62" width="1476" height="976" rx="14" fill="none" stroke="#e5b77b" stroke-width="2"/>
  <g font-family="Arial,Helvetica,sans-serif" text-anchor="middle">
    <g stroke="#f29a38" stroke-width="8" fill="none" stroke-linecap="round">
      <path d="M735 120h90c26 0 42 16 42 36s-16 36-42 36h-55c-26 0-42 16-42 36s16 36 42 36h95"/>
    </g>
    <text x="800" y="315" font-size="40" font-weight="700" fill="#1a1d22">SAIL-HPC</text>
    <text x="800" y="375" font-size="27" fill="#a5661d">${LONG_FORM_NAME}</text>
    <text x="800" y="470" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#1a1d22">Certificate of Practice Completion</text>
    <text x="800" y="535" font-size="24" letter-spacing="5" fill="#73757a">THIS CERTIFIES THAT</text>
    <text x="800" y="625" font-family="Georgia,serif" font-size="68" fill="#1a1d22">${name}</text>
    <text x="800" y="675" font-size="27" fill="#c27522">${affiliationLine}</text>
    <line x1="430" y1="720" x2="1170" y2="720" stroke="#a5a5a5"/>
    <text x="800" y="775" font-size="28" fill="#555">completed the</text>
    <text x="800" y="820" font-size="34" font-weight="700" fill="#1a1d22">${EXAM_NAME}</text>
    <circle cx="800" cy="915" r="78" fill="#d78c31"/>
    <circle cx="800" cy="915" r="64" fill="none" stroke="#ffe6bd" stroke-width="6"/>
    <text x="800" y="928" font-size="44" font-weight="800" fill="white">100%</text>
    <text x="260" y="945" font-size="23" fill="#555">${date}</text>
    <text x="1340" y="945" font-size="23" fill="#555">100 / 100</text>
    <text x="800" y="1030" font-size="20" fill="#666">Certificate ID: ${id} · Practice-completion artifact, not a professional license</text>
  </g>
</svg>`;
}

function readinessScore() {
  try { return Number(JSON.parse(localStorage.getItem(EXAM_KEY) || "{}").score || 0); }
  catch { return 0; }
}

function value(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function text(id) {
  return document.getElementById(id)?.textContent?.trim() || "";
}

function setStatus(message, status) {
  const node = document.getElementById("certificate-status");
  if (!node) return;
  node.textContent = message;
  node.dataset.status = status;
}

function safeFileName(value) {
  return String(value || "learner").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "learner";
}

function escapeXML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);
}
