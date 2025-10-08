// timer.js (UPDATED FOR OFFLINE SUPPORT)

// --- STATE ---
let currentDate = new Date().toISOString().split('T')[0];
let categories = [];
let timeLogs = {};
let timeSpentOnDate = {};
let currentCategory = null;
let isRunning = false;
let countdownInterval;
let timeRemaining = 0;
let sessionDurationSet = 0;

// --- DOM ELEMENTS ---
// (No changes here)
const categorySelector = document.getElementById('category-selector');
const categoryDisplay = document.getElementById('current-category-display');
const timeDisplay = document.getElementById('time-display');
const startStopBtn = document.getElementById('startStopBtn');
const resetBtn = document.getElementById('resetBtn');
const timeTrackingInfo = document.getElementById('time-tracking-info');
const currentDayDisplay = document.getElementById('current-day-display');
const minutesInput = document.getElementById('minutes-input');
const secondsInput = document.getElementById('seconds-input');

// --- HELPER & UI FUNCTIONS ---
// (No changes in these functions)
function formatCountdown(ms) { if (ms < 0) ms = 0; const totalSeconds = Math.floor(ms / 1000); const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0'); const seconds = String(totalSeconds % 60).padStart(2, '0'); return `${minutes}:${seconds}`; }
function formatDuration(ms) { if (ms < 0) ms = 0; const totalSeconds = Math.floor(ms / 1000); const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; let parts = []; if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}m`); if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`); return parts.join(' '); }
function formatDisplayDate(dateString) { const date = new Date(dateString); const userTimezoneOffset = date.getTimezoneOffset() * 60000; const adjustedDate = new Date(date.getTime() + userTimezoneOffset); return adjustedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
function updateTrackingInfo() { if (!currentCategory) { timeTrackingInfo.innerHTML = `<span>--</span>`; return; } const categoryData = categories.find(cat => cat.name === currentCategory); if (!categoryData) { timeTrackingInfo.innerHTML = `<span>Category not in plan.</span>`; return; } const targetMs = (categoryData.target || 0) * 3600 * 1000; const spentMs = timeSpentOnDate[currentCategory] || 0; const remainingMs = targetMs - spentMs; timeTrackingInfo.innerHTML = `Spent: <strong>${formatDuration(spentMs)}</strong> / Target: <strong>${formatDuration(targetMs)}</strong> | Remaining: <strong>${formatDuration(remainingMs)}</strong>`; }
function renderCategoryButtons() { categorySelector.innerHTML = ''; if (categories.length === 0) { categorySelector.textContent = 'No categories planned. Go to the Planner to add some.'; return; } categories.forEach(cat => { const button = document.createElement('button'); button.className = 'category-btn'; button.textContent = cat.name; button.addEventListener('click', () => selectCategory(cat.name)); categorySelector.appendChild(button); }); }
function selectCategory(categoryName) { if (isRunning) pauseTimer(); resetTimer(); currentCategory = categoryName; categoryDisplay.textContent = `Timing: ${currentCategory}`; document.querySelectorAll('.category-btn').forEach(btn => { btn.classList.toggle('active', btn.textContent === currentCategory); }); updateTrackingInfo(); startStopBtn.disabled = false; resetBtn.disabled = false; }


// --- NEW: OFFLINE-FIRST SAVE LOGIC ---
async function saveData(category, duration, date) {
    const categoryData = categories.find(cat => cat.name === category);
    const target = categoryData ? categoryData.target : 0;
    const entry = { category, duration, day: date, target };

    // Update local UI immediately
    timeSpentOnDate[currentCategory] = (timeSpentOnDate[currentCategory] || 0) + duration;
    timeLogs[currentDate] = timeSpentOnDate;
    localStorage.setItem('timeLogs', JSON.stringify(timeLogs));
    updateTrackingInfo();
    console.log('Data saved locally to localStorage.');

    // Save to IndexedDB for background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            await saveEntryToOutbox(entry);
            const swRegistration = await navigator.serviceWorker.ready;
            await swRegistration.sync.register('sync-timer-data');
            console.log('Saved to outbox and sync registered.');
        } catch (error) {
            console.error('Failed to save for sync:', error);
            // Fallback for if IndexedDB fails
            sendDataToServer(entry);
        }
    } else {
        // Fallback for browsers without background sync
        console.log('Background sync not supported, sending directly.');
        sendDataToServer(entry);
    }
}

// --- Helper to send data to the server ---
async function sendDataToServer(entry) {
    try {
        await fetch('/api/save-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
        });
        console.log('Data sent directly to server.');
    } catch (error) {
        console.error('Error: Failed to send data to server.', error);
        alert('Could not save data to the server. Please check your connection.');
    }
}


// --- TIMER LOGIC (MODIFIED) ---
function timerCompleted() {
    const notificationSound = new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3');
    notificationSound.play();

    if (Notification.permission === "granted") {
        new Notification("Session Complete!", {
            body: `You finished your "${currentCategory}" session.`,
            icon: 'images/icon-192.png'
        });
    }

    // Use the new saveData function
    saveData(currentCategory, sessionDurationSet, currentDate);

    resetTimer();
}

// (No changes in startTimer, pauseTimer, resetTimer)
function startTimer() { if (isRunning) return; if (timeRemaining <= 0) { const minutes = parseInt(minutesInput.value, 10) || 0; const seconds = parseInt(secondsInput.value, 10) || 0; sessionDurationSet = (minutes * 60 + seconds) * 1000; timeRemaining = sessionDurationSet; } if (timeRemaining <= 0) { alert("Please set a duration greater than zero."); return; } isRunning = true; startStopBtn.textContent = 'Pause'; minutesInput.disabled = true; secondsInput.disabled = true; const startTime = Date.now(); const endTime = startTime + timeRemaining; countdownInterval = setInterval(() => { timeRemaining = endTime - Date.now(); if (timeRemaining <= 0) { clearInterval(countdownInterval); timeDisplay.textContent = formatCountdown(0); document.title = "Tracker Timer"; timerCompleted(); return; } timeDisplay.textContent = formatCountdown(timeRemaining); document.title = `${formatCountdown(timeRemaining)} - ${currentCategory || 'Timer'}`; }, 100); }
function pauseTimer() { if (!isRunning) return; clearInterval(countdownInterval); isRunning = false; startStopBtn.textContent = 'Start'; minutesInput.disabled = false; secondsInput.disabled = false; document.title = "Tracker Timer"; }
function resetTimer() { if (isRunning) pauseTimer(); timeRemaining = 0; sessionDurationSet = 0; const minutes = String(minutesInput.value || 25).padStart(2, '0'); const seconds = String(secondsInput.value || 0).padStart(2, '0'); timeDisplay.textContent = `${minutes}:${seconds}`; minutesInput.disabled = false; secondsInput.disabled = false; }


// --- INITIALIZER ---
// (No changes here)
function initializeTimer() { if (Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); } const savedDate = localStorage.getItem('currentDate'); if (savedDate) { currentDate = savedDate; } currentDayDisplay.textContent = formatDisplayDate(currentDate); const savedPlannerLogs = JSON.parse(localStorage.getItem('plannerLogs')) || {}; categories = savedPlannerLogs[currentDate] || []; const savedTimeLogs = JSON.parse(localStorage.getItem('timeLogs')); if (savedTimeLogs) { timeLogs = savedTimeLogs; } timeSpentOnDate = timeLogs[currentDate] || {}; renderCategoryButtons(); startStopBtn.addEventListener('click', () => { if (!currentCategory) return; isRunning ? pauseTimer() : startTimer(); }); resetBtn.addEventListener('click', () => { if (!currentCategory) return; resetTimer(); }); minutesInput.addEventListener('change', resetTimer); secondsInput.addEventListener('change', resetTimer); window.addEventListener('pagehide', () => { if (isRunning) { pauseTimer(); } }); }

initializeTimer();