// --- STATE ---
let currentDate = new Date().toISOString().split('T')[0];
let categories = []; // Holds the plan for the current date
let timeLogs = {}; // Master object for all tracked times on all dates
let timeSpentOnDate = {}; // Tracked time for the current date only
let currentCategory = null;
let isRunning = false;
let sessionStartTime = 0;
let timerInterval;

// --- DOM ELEMENTS ---
const categorySelector = document.getElementById('category-selector');
const categoryDisplay = document.getElementById('current-category-display');
const timeDisplay = document.getElementById('time-display');
const startStopBtn = document.getElementById('startStopBtn');
const resetBtn = document.getElementById('resetBtn');
const timeTrackingInfo = document.getElementById('time-tracking-info');
const currentDayDisplay = document.getElementById('current-day-display');

// --- HELPER FUNCTIONS ---
function formatTime(ms) { const date = new Date(ms); const minutes = String(date.getUTCMinutes()).padStart(2, '0'); const seconds = String(date.getUTCSeconds()).padStart(2, '0'); const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0'); return `${minutes}:${seconds}.${milliseconds}`; }
function formatDuration(ms) { if (ms < 0) ms = 0; const totalSeconds = Math.floor(ms / 1000); const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; let parts = []; if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}m`); if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`); return parts.join(' '); }
function formatDisplayDate(dateString) { const date = new Date(dateString); const userTimezoneOffset = date.getTimezoneOffset() * 60000; const adjustedDate = new Date(date.getTime() + userTimezoneOffset); return adjustedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }

// --- UI FUNCTIONS ---
function updateTrackingInfo() {
    if (!currentCategory) { timeTrackingInfo.innerHTML = `<span>--</span>`; return; }
    const categoryData = categories.find(cat => cat.name === currentCategory);
    if (!categoryData) { timeTrackingInfo.innerHTML = `<span>Category not in plan.</span>`; return; }
    const targetMs = (categoryData.target || 0) * 3600 * 1000;
    const spentMs = timeSpentOnDate[currentCategory] || 0;
    const remainingMs = targetMs - spentMs;
    timeTrackingInfo.innerHTML = `Spent: <strong>${formatDuration(spentMs)}</strong> / Target: <strong>${formatDuration(targetMs)}</strong> | Remaining: <strong>${formatDuration(remainingMs)}</strong>`;
}

function renderCategoryButtons() {
    categorySelector.innerHTML = '';
    if (categories.length === 0) { categorySelector.textContent = 'No categories planned for this day. Go to the Planner to add some.'; return; }
    categories.forEach(cat => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.textContent = cat.name;
        button.addEventListener('click', () => selectCategory(cat.name));
        categorySelector.appendChild(button);
    });
}

function selectCategory(categoryName) {
    if (isRunning) stopTimer();
    currentCategory = categoryName;
    categoryDisplay.textContent = `Timing: ${currentCategory}`;
    document.querySelectorAll('.category-btn').forEach(btn => { btn.classList.toggle('active', btn.textContent === currentCategory); });
    timeDisplay.textContent = '00:00:00.000';
    updateTrackingInfo();
    startStopBtn.disabled = false;
    resetBtn.disabled = false;
}

// --- TIMER & DATA LOGIC ---

/**
 * MODIFIED: This function now sends the target hours to the backend.
 */
async function saveTimeToDatabase(category, duration, date) {
    // Find the target for the current category from our plan
    const categoryData = categories.find(cat => cat.name === category);
    const target = categoryData ? categoryData.target : 0; // Default to 0 if not found

    try {
        await fetch('/api/save-time', { // Ensure port is correct
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, duration, day: date, target }), // NEW: target is added
        });
        console.log(`Saved session for ${category} with target ${target}h`);
    } catch (error) {
        console.error('Error: Failed to save time. Is the server running?');
    }
}

function startTimer() {
    sessionStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedInSession = Date.now() - sessionStartTime;
        timeDisplay.textContent = formatTime(elapsedInSession);
    }, 10);
    startStopBtn.textContent = 'Pause';
    isRunning = true;
}

async function stopTimer() {
    if (!isRunning) return;
    const sessionDuration = Date.now() - sessionStartTime;
    clearInterval(timerInterval);
    isRunning = false;
    startStopBtn.textContent = 'Start';
    if (sessionDuration > 1000) {
        timeSpentOnDate[currentCategory] = (timeSpentOnDate[currentCategory] || 0) + sessionDuration;
        timeLogs[currentDate] = timeSpentOnDate;
        localStorage.setItem('timeLogs', JSON.stringify(timeLogs));
        // The save function now automatically includes the target
        await saveTimeToDatabase(currentCategory, sessionDuration, currentDate);
        updateTrackingInfo();
    }
    timeDisplay.textContent = '00:00:00.000';
}

// --- INITIALIZER ---
function initializeTimer() {
    const savedDate = localStorage.getItem('currentDate');
    if (savedDate) { currentDate = savedDate; }
    currentDayDisplay.textContent = formatDisplayDate(currentDate);

    const savedPlannerLogs = JSON.parse(localStorage.getItem('plannerLogs')) || {};
    categories = savedPlannerLogs[currentDate] || [];

    const savedTimeLogs = JSON.parse(localStorage.getItem('timeLogs'));
    if (savedTimeLogs) { timeLogs = savedTimeLogs; }
    timeSpentOnDate = timeLogs[currentDate] || {};

    renderCategoryButtons();

    startStopBtn.addEventListener('click', () => { if (!currentCategory) return; isRunning ? stopTimer() : startTimer(); });
    resetBtn.addEventListener('click', () => {
        if (isRunning) { clearInterval(timerInterval); isRunning = false; startStopBtn.textContent = 'Start'; }
        timeDisplay.textContent = '00:00:00.000';
    });
}

initializeTimer();