let dialogEl = null;
let confusedBtn = null;
let dismissBtn = null;
let extraContentEl = null;
let isOpen = false;
let confusedStage = 0;
let previouslyFocused = null;

const PBS_KIDS_URL = "https://pbskids.org/games/play/coloring/33484";

const CONFUSED_APPENDIX = [
  `<p class="about-extra-block"><em>Okay</em>, so Power Query is the data-cleaning bit of Excel and Power BI. Every button you click adds a <em>step</em> to the query. But the step names look like <code>#&quot;Changed Type&quot;</code> - hash, quotes, spaces, the works. This page shortens them to things like <code>Type</code>. Paste messy code on the top. Tidy code appears on the bottom. That's the whole trick.</p>`,
  `<p class="about-extra-block">Big button make steps. Step name very long. Name complicated. Brain hurt. We give, you fix. Put in big hole. Comes nice below. Short name good. Magic? No. Tool.</p>`,
];

const FOCUSABLE =
  'button:not([disabled]):not(.hidden), [contenteditable="true"]:not([contenteditable="false"]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements() {
  return [...dialogEl.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null
  );
}

function trapFocus(e) {
  if (!isOpen || e.key !== "Tab") return;

  const focusable = getFocusableElements();
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function handleEscape(e) {
  if (!isOpen || e.key !== "Escape") return;
  e.preventDefault();
  e.stopPropagation();
  closeDialog();
}

function resetConfusedState() {
  confusedStage = 0;
  confusedBtn.textContent = "Huh?";
  confusedBtn.classList.remove("hidden");
  dismissBtn.classList.remove("hidden");
  extraContentEl.innerHTML = "";
  extraContentEl.classList.add("hidden");
}

function openDialog() {
  if (isOpen) return;

  previouslyFocused = document.activeElement;
  resetConfusedState();
  dialogEl.classList.remove("hidden");
  document.body.classList.add("modal-open");
  isOpen = true;

  const closeBtn = dialogEl.querySelector(".modal-close");
  closeBtn?.focus();
}

function closeDialog() {
  if (!isOpen) return;

  dialogEl.classList.add("hidden");
  document.body.classList.remove("modal-open");
  isOpen = false;
  resetConfusedState();

  if (previouslyFocused?.focus) {
    previouslyFocused.focus();
  }
}

function handleConfusedClick() {
  if (confusedStage === 0) {
    extraContentEl.insertAdjacentHTML("beforeend", CONFUSED_APPENDIX[0]);
    extraContentEl.classList.remove("hidden");
    confusedBtn.textContent = "Uhh...";
    confusedStage = 1;
    return;
  }

  if (confusedStage === 1) {
    extraContentEl.insertAdjacentHTML("beforeend", CONFUSED_APPENDIX[1]);
    confusedBtn.textContent = "I don't get it";
    confusedStage = 2;
    return;
  }

  window.location.href = PBS_KIDS_URL;
}

export function isAboutDialogOpen() {
  return isOpen;
}

export function initAboutDialog() {
  dialogEl = document.getElementById("about-dialog");
  const openBtn = document.getElementById("about-open-btn");
  const closeBtn = dialogEl.querySelector(".modal-close");
  const backdrop = dialogEl.querySelector(".modal-backdrop");
  confusedBtn = document.getElementById("about-confused-btn");
  dismissBtn = document.getElementById("about-close-btn");
  extraContentEl = document.getElementById("about-extra-content");

  openBtn.addEventListener("click", openDialog);
  closeBtn.addEventListener("click", closeDialog);
  backdrop.addEventListener("click", closeDialog);
  dismissBtn.addEventListener("click", closeDialog);
  confusedBtn.addEventListener("click", handleConfusedClick);

  dialogEl.addEventListener("keydown", trapFocus);
  document.addEventListener("keydown", handleEscape, true);
}
