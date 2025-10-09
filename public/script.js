// --- Get references to all HTML elements ---
const timeDisplay = document.getElementById('time-display');
const startStopBtn = document.getElementById('startStopBtn');
const resetBtn = document.getElementById('resetBtn');
const categorySelector = document.getElementById('category-selector');
const categoryDisplay = document.getElementById('current-category-display');
const historyLog = document.getElementById('history-log');
const newCategoryInput = document.getElementById('new-category-input');
const addCategoryBtn = document.getElementById('add-category-btn');
// NEW: Timetable elements
const startTimeInput = document.getElementById('start-time-input');
const endTimeInput = document.getElementById('end-time-input');
const scheduleCategorySelect = document.getElementById('schedule-category-select');
const addScheduleBtn = document.getElementById('add-schedule-btn');
const scheduleDisplay = document.getElementById('schedule-display');
import { injectSpeedInsights } from '@vercel/speed-insights';

injectSpeedInsights();
// --- State Management ---
let categories = [];
let schedule = []; // NEW: Array to hold schedule items
let currentCategory = null;
let categoryTimes = {};
let startTime = 0;
let timerInterval;
let isRunning = false;

// --- Helper Functions (formatTime, formatDuration) ---
// ... (These functions remain the same)
function formatTime(ms) { const date = new Date(ms); const minutes = String(date.getUTCMinutes()).padStart(2, '0'); const seconds = String(date.getUTCSeconds()).padStart(2, '0'); const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0'); return `${minutes}:${seconds}.${milliseconds}`; }
function formatDuration(ms) { if (ms < 1000) return `${ms} ms`; const totalSeconds = Math.floor(ms / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${minutes}m ${seconds}s`; }


// --- API Communication (saveTimeToDatabase, fetchAndDisplayEntries) ---
// ... (These functions remain the same)
async function saveTimeToDatabase(category, duration) { if (duration < 1000) { console.log("Session too short, not saving."); return; } try { await fetch('http://api/save-time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, duration }), }); } catch (error) { console.error('Error: Failed to save time. Is the server running?'); } }
async function fetchAndDisplayEntries(category) { historyLog.innerHTML = '<li>Loading...</li>'; try { const response = await fetch(`http://api/get-entries/${category}`); if (!response.ok) { historyLog.innerHTML = '<li>Could not load history.</li>'; return; } const entries = await response.json(); historyLog.innerHTML = ''; if (entries.length === 0) { historyLog.innerHTML = '<li>No saved sessions for this category.</li>'; } else { entries.forEach(entry => { const li = document.createElement('li'); const durationSpan = document.createElement('span'); durationSpan.className = 'duration'; durationSpan.textContent = formatDuration(entry.duration); const dateSpan = document.createElement('span'); dateSpan.className = 'date'; dateSpan.textContent = new Date(entry.date).toLocaleDateString(); li.appendChild(durationSpan); li.appendChild(dateSpan); historyLog.appendChild(li); }); } } catch (error) { console.error('Error fetching history:', error); historyLog.innerHTML = '<li>Error connecting to server.</li>'; } }


// --- UI Rendering and Logic ---

function renderCategoryButtons() {
    categorySelector.innerHTML = '';
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.textContent = category;
        button.dataset.category = category;
        button.addEventListener('click', () => selectCategory(category));
        categorySelector.appendChild(button);
    });
    updateScheduleCategoryDropdown(); // MODIFIED: Update dropdown when categories change
}

// NEW: Renders the schedule display
function renderSchedule() {
    scheduleDisplay.innerHTML = '';
    // Sort schedule by start time before rendering
    schedule.sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    schedule.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'schedule-item';
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'time';
        timeSpan.textContent = `${item.startTime} - ${item.endTime}`;
        
        const categorySpan = document.createElement('span');
        categorySpan.className = 'category';
        categorySpan.textContent = item.category;
        
        const startBtn = document.createElement('button');
        startBtn.className = 'start-btn';
        startBtn.textContent = 'Start';
        startBtn.onclick = () => selectCategory(item.category);
        
        itemDiv.appendChild(timeSpan);
        itemDiv.appendChild(categorySpan);
        itemDiv.appendChild(startBtn);
        scheduleDisplay.appendChild(itemDiv);
    });
}

// NEW: Populates the category dropdown in the schedule form
function updateScheduleCategoryDropdown() {
    scheduleCategorySelect.innerHTML = '';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        scheduleCategorySelect.appendChild(option);
    });
}

function selectCategory(category) {
    if (isRunning) stopTimer();
    currentCategory = category;
    categoryDisplay.textContent = `Timing: ${currentCategory}`;
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === currentCategory);
    });
    // Scroll to the top to see the timer
    window.scrollTo({ top: 0, behavior: 'smooth' });
    timeDisplay.textContent = formatTime(categoryTimes[currentCategory]);
    startStopBtn.disabled = false;
    resetBtn.disabled = false;
    fetchAndDisplayEntries(category);
}

// --- Timer Logic (updateTime, startTimer, stopTimer) ---
// ... (These functions remain the same)
function updateTime() { const elapsedTime = Date.now() - startTime; timeDisplay.textContent = formatTime(elapsedTime); }
function startTimer() { startTime = Date.now() - categoryTimes[currentCategory]; timerInterval = setInterval(updateTime, 10); startStopBtn.textContent = 'Pause'; startStopBtn.style.backgroundColor = '#ffc107'; isRunning = true; }
function stopTimer() { clearInterval(timerInterval); const finalTime = Date.now() - startTime; categoryTimes[currentCategory] = finalTime; startStopBtn.textContent = 'Start'; startStopBtn.style.backgroundColor = '#4CAF50'; isRunning = false; }

// --- Event Listeners ---
startStopBtn.addEventListener('click', () => { if (!currentCategory) return; if (!isRunning) startTimer(); else stopTimer(); });
resetBtn.addEventListener('click', async () => { if (!currentCategory) return; const finalElapsedTime = isRunning ? (Date.now() - startTime) : categoryTimes[currentCategory]; await saveTimeToDatabase(currentCategory, finalElapsedTime); if (isRunning) clearInterval(timerInterval); categoryTimes[currentCategory] = 0; timeDisplay.textContent = '00:00:00.000'; startStopBtn.textContent = 'Start'; startStopBtn.style.backgroundColor = '#4CAF50'; isRunning = false; fetchAndDisplayEntries(currentCategory); });

addCategoryBtn.addEventListener('click', () => {
    const newCategory = newCategoryInput.value.trim();
    if (newCategory === '') { alert('Category name cannot be empty.'); return; }
    if (categories.map(c => c.toLowerCase()).includes(newCategory.toLowerCase())) { alert('This category already exists.'); return; }
    
    categories.push(newCategory);
    categoryTimes[newCategory] = 0;
    localStorage.setItem('timerCategories', JSON.stringify(categories));
    
    renderCategoryButtons(); // This will also update the dropdown
    newCategoryInput.value = '';
    selectCategory(newCategory);
});

// NEW: Event listener for adding a schedule item
addScheduleBtn.addEventListener('click', () => {
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    const category = scheduleCategorySelect.value;
    
    if (!startTime || !endTime || !category) {
        alert('Please fill out all schedule fields.');
        return;
    }
    if (startTime >= endTime) {
        alert('End time must be after start time.');
        return;
    }

    schedule.push({ startTime, endTime, category });
    localStorage.setItem('timerSchedule', JSON.stringify(schedule));
    renderSchedule();
});

// --- Initializer ---
function initializeApp() {
    // Load Categories
    const savedCategories = JSON.parse(localStorage.getItem('timerCategories'));
    if (savedCategories && savedCategories.length > 0) {
        categories = savedCategories;
    } else {
        categories = ['Daily Routine', 'Call', 'Project']; // Updated defaults
    }
    categories.forEach(category => { categoryTimes[category] = 0; });
    renderCategoryButtons();

    // Load Schedule
    const savedSchedule = JSON.parse(localStorage.getItem('timerSchedule'));
    if (savedSchedule) {
        schedule = savedSchedule;
    }
    renderSchedule();
}

initializeApp();