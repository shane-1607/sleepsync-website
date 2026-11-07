const STORAGE_KEY = "sleepsync.entries.v1";
const SESSION_KEY = "sleepsync.session-start.v1";
const panels = [...document.querySelectorAll("[data-panel]")];
const navButtons = [...document.querySelectorAll(".nav-link[data-view]")];

function openView(name) {
  if (!panels.length) return;
  const selected = panels.some((panel) => panel.dataset.panel === name) ? name : "home";
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== selected; });
  navButtons.forEach((button) => {
    const active = button.dataset.view === selected;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach((button) => button.addEventListener("click", () => openView(button.dataset.view)));
document.querySelectorAll("[data-open-view]").forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.openView));
});

const initialView = new URLSearchParams(window.location.search).get("view");
openView(initialView || "home");
if (window.location.hash === "#about-sleepsync") {
  document.getElementById("about-sleepsync")?.scrollIntoView({ behavior: "smooth" });
}

const helpMenuTrigger = document.getElementById("help-menu-trigger");
const helpMenuPanel = document.getElementById("help-menu-panel");

function setHelpMenuOpen(isOpen) {
  if (!helpMenuTrigger || !helpMenuPanel) return;
  helpMenuPanel.hidden = !isOpen;
  helpMenuTrigger.setAttribute("aria-expanded", String(isOpen));
}

helpMenuTrigger?.addEventListener("click", () => {
  setHelpMenuOpen(helpMenuPanel.hidden);
});

document.addEventListener("click", (event) => {
  if (!helpMenuTrigger?.contains(event.target) && !helpMenuPanel?.contains(event.target)) {
    setHelpMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setHelpMenuOpen(false);
});

function readEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(entries)) throw new Error("Saved sleep history is not a list.");
    return entries.filter((entry) =>
      entry && typeof entry.date === "string" &&
      Number.isFinite(entry.hours) && entry.hours > 0 && entry.hours <= 24
    );
  } catch (error) {
    console.error("Could not read SleepSync sleep history.", error);
    return [];
  }
}

function writeEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Could not save SleepSync sleep history.", error);
    return false;
  }
  return true;
}

function scoreFor(hours) {
  return Math.max(0, Math.min(100, Math.round(100 - Math.abs(hours - 8) * 18)));
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHours(hours) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, "")}h`;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateString : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function renderScore(entry) {
  const score = document.getElementById("sleep-score");
  const caption = document.getElementById("score-caption");
  const meter = document.getElementById("score-meter");
  if (!score || !caption || !meter) return;
  const meterFill = meter.querySelector("span");
  if (!entry) {
    score.textContent = "—";
    caption.textContent = "Log sleep duration in Trends to see an estimate.";
    meter.setAttribute("aria-valuenow", "0");
    meter.setAttribute("aria-valuetext", "No score yet");
    if (meterFill) meterFill.style.width = "0%";
    return;
  }
  const value = scoreFor(entry.hours);
  score.textContent = String(value);
  caption.textContent = `Estimate based on ${formatHours(entry.hours)} logged; not a health measurement.`;
  meter.setAttribute("aria-valuenow", String(value));
  meter.setAttribute("aria-valuetext", `Estimated sleep quality score ${value} out of 100`);
  if (meterFill) meterFill.style.width = `${value}%`;
}

function renderChart(entries) {
  const chart = document.getElementById("sleep-chart");
  if (!chart) return;
  const recent = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  chart.replaceChildren();
  if (!recent.length) {
    chart.setAttribute("aria-label", "No sleep entries yet");
    return;
  }
  chart.setAttribute("aria-label", `Sleep durations for ${recent.length} recent nights`);
  recent.forEach((entry) => {
    const wrap = document.createElement("div");
    wrap.className = "chart-bar-wrap";
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.dataset.inRange = String(entry.hours >= 7 && entry.hours <= 9);
    bar.style.height = `${Math.max(4, Math.min(100, entry.hours / 12 * 100))}%`;
    const hours = document.createElement("span");
    hours.className = "chart-hours";
    hours.textContent = entry.hours.toFixed(1);
    bar.append(hours);
    const day = document.createElement("span");
    day.className = "chart-day";
    day.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${entry.date}T12:00:00`));
    wrap.append(bar, day);
    chart.append(wrap);
  });
}

function renderHistory(entries) {
  const history = document.getElementById("sleep-history");
  const count = document.getElementById("history-count");
  const clearButton = document.getElementById("clear-data");
  if (!history || !count || !clearButton) return;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  count.textContent = `${entries.length} ${entries.length === 1 ? "night" : "nights"}`;
  clearButton.hidden = entries.length === 0;
  history.replaceChildren();
  if (!sorted.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Your logged nights will appear here. Add your first entry above.";
    history.append(empty);
    return;
  }
  sorted.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = formatDate(entry.date);
    const hours = document.createElement("span");
    hours.className = "history-hours";
    hours.textContent = formatHours(entry.hours);
    const score = document.createElement("span");
    score.className = "history-score";
    score.textContent = `${scoreFor(entry.hours)} score`;
    row.append(date, hours, score);
    history.append(row);
  });
}

function renderEntries() {
  const entries = readEntries();
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  renderScore(latest);
  renderChart(entries);
  renderHistory(entries);
}

const logForm = document.getElementById("sleep-log-form");
const dateInput = document.getElementById("sleep-date");
if (dateInput) dateInput.value = localDateString();
if (dateInput) dateInput.max = localDateString();

logForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const hours = Number(document.getElementById("hours-slept").value);
  const date = dateInput.value;
  const message = document.getElementById("log-message");
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 24 || !date) {
    message.textContent = "Enter a date and a duration between 0.5 and 24 hours.";
    return;
  }
  const entries = readEntries().filter((entry) => entry.date !== date);
  entries.push({ date, hours });
  if (!writeEntries(entries)) {
    message.textContent = "Your entry could not be saved. Check your browser storage settings and try again.";
    return;
  }
  message.textContent = `Logged ${formatHours(hours)} for ${formatDate(date)}.`;
  logForm.reset();
  dateInput.value = localDateString();
  renderEntries();
});

document.getElementById("clear-data")?.addEventListener("click", () => {
  if (!window.confirm("Clear all SleepSync sleep history saved in this browser?")) return;
  if (!writeEntries([])) {
    document.getElementById("log-message").textContent = "Your sleep history could not be cleared. Check your browser storage settings.";
    return;
  }
  renderEntries();
});

const timerDisplay = document.getElementById("sleep-timer");
const startButton = document.getElementById("start-sleep");
const stopButton = document.getElementById("stop-sleep");
const sessionMessage = document.getElementById("session-message");
let timerInterval;

function elapsedSeconds(startedAt) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatClock(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function updateTimer() {
  const rawStart = localStorage.getItem(SESSION_KEY);
  const startedAt = Number(rawStart);
  if (!rawStart || !Number.isFinite(startedAt)) return;
  timerDisplay.textContent = formatClock(elapsedSeconds(startedAt));
}

function setTimerRunning(isRunning) {
  startButton.disabled = isRunning;
  stopButton.disabled = !isRunning;
}

function resumeTimer() {
  const startedAt = Number(localStorage.getItem(SESSION_KEY));
  if (!Number.isFinite(startedAt) || startedAt <= 0) return;
  setTimerRunning(true);
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 1000);
  sessionMessage.textContent = "Your sleep session is in progress.";
}

startButton?.addEventListener("click", () => {
  try {
    localStorage.setItem(SESSION_KEY, String(Date.now()));
  } catch (error) {
    console.error("Could not start SleepSync sleep timer.", error);
    sessionMessage.textContent = "The timer could not start. Check your browser storage settings.";
    return;
  }
  setTimerRunning(true);
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 1000);
  sessionMessage.textContent = "Sleep timer started. Rest well.";
});

stopButton?.addEventListener("click", () => {
  const startedAt = Number(localStorage.getItem(SESSION_KEY));
  const seconds = elapsedSeconds(startedAt);
  window.clearInterval(timerInterval);
  localStorage.removeItem(SESSION_KEY);
  setTimerRunning(false);
  timerDisplay.textContent = "00:00:00";
  if (seconds < 900) {
    sessionMessage.textContent = "Session ended. Track for at least 15 minutes to save it as a night.";
    return;
  }
  const date = new Date(startedAt).toISOString().slice(0, 10);
  const hours = Math.round((seconds / 3600) * 4) / 4;
  const entries = readEntries().filter((entry) => entry.date !== date);
  entries.push({ date, hours });
  if (writeEntries(entries)) {
    sessionMessage.textContent = `Session saved: ${formatHours(hours)}. Your trends are updated.`;
    renderEntries();
  } else {
    sessionMessage.textContent = "Session ended, but could not be saved. Check your browser storage settings.";
  }
});

if (timerDisplay) resumeTimer();
renderEntries();

let audioContext;
let activeNodes = [];
let pianoTimeout;
const soundNames = { rain: "Soft rain", piano: "Solo piano", night: "Night air" };
const soundStatus = document.getElementById("sound-status");
const stopSoundButton = document.getElementById("stop-sound");
const volumeControl = document.getElementById("volume");

function stopSound() {
  window.clearTimeout(pianoTimeout);
  activeNodes.forEach((node) => {
    try { node.stop?.(); } catch { /* Oscillator may already have stopped. */ }
    node.disconnect?.();
  });
  activeNodes = [];
  if (audioContext && audioContext.state !== "closed") audioContext.close();
  audioContext = undefined;
  document.querySelectorAll(".sound-card").forEach((card) => card.classList.remove("is-playing"));
  if (soundStatus) soundStatus.textContent = "Nothing playing";
  if (stopSoundButton) stopSoundButton.disabled = true;
}

let masterGain;

function makeTone(frequency, startAt, duration, volume, type = "sine") {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + .08);
  gain.gain.exponentialRampToValueAtTime(.001, startAt + duration);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + .02);
  activeNodes.push(oscillator, gain);
}

function makeDroneTone(frequency, volume) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain).connect(masterGain);
  oscillator.start();
  activeNodes.push(oscillator, gain);
}

function playPiano() {
  const notes = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
  const startAt = audioContext.currentTime + .03;
  const volume = Number(volumeControl.value) / 1000;
  notes.forEach((frequency, index) => makeTone(frequency, startAt + index * 1.15, 1.05, volume, "triangle"));
  pianoTimeout = window.setTimeout(() => {
    if (audioContext && document.querySelector('[data-sound="piano"].is-playing')) playPiano();
  }, notes.length * 1150);
}

async function playSound(name, card) {
  stopSound();
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Audio is not supported by this browser.");
    audioContext = new AudioContextConstructor();
    await audioContext.resume();
    masterGain = audioContext.createGain();
    masterGain.gain.value = Number(volumeControl.value) / 1000;
    masterGain.connect(audioContext.destination);
    activeNodes.push(masterGain);
    card.classList.add("is-playing");
    soundStatus.textContent = `${soundNames[name]} is playing`;
    stopSoundButton.disabled = false;
    const volume = Number(volumeControl.value) / 1000;
    if (name === "piano") {
      playPiano();
    } else if (name === "rain") {
      const bufferSize = audioContext.sampleRate * 2;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < bufferSize; index++) data[index] = (Math.random() * 2 - 1) * .34;
      const noise = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      noise.buffer = buffer;
      noise.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 850;
      gain.gain.value = volume;
      noise.connect(filter).connect(gain).connect(masterGain);
      noise.start();
      activeNodes.push(noise, filter, gain);
    } else {
      makeDroneTone(110, volume * .48);
      makeDroneTone(164.81, volume * .22);
    }
  } catch (error) {
    console.error("Could not play SleepSync soundscape.", error);
    stopSound();
    if (soundStatus) soundStatus.textContent = "Audio could not start in this browser.";
  }
}

document.querySelectorAll(".sound-card[data-sound]").forEach((card) => {
  card.addEventListener("click", () => playSound(card.dataset.sound, card));
});
stopSoundButton?.addEventListener("click", stopSound);
volumeControl?.addEventListener("input", () => {
  if (audioContext && masterGain) masterGain.gain.setTargetAtTime(Number(volumeControl.value) / 1000, audioContext.currentTime, .08);
});
window.addEventListener("pagehide", stopSound);
