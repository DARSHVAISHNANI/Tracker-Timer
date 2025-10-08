// --- CONFIGURATION & STATE ---
const TOTAL_DAY_HOURS = 8;
let currentDate = new Date().toISOString().split('T')[0];

// --- DOM ELEMENTS ---
const chartCanvas = document.getElementById('progress-pie-chart');
const analysisSummary = document.getElementById('analysis-summary');
const currentDayDisplay = document.getElementById('current-day-display');

// --- HELPER FUNCTIONS ---
function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    return parts.join(' ');
}

function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
    return adjustedDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

// --- INITIALIZER ---
function initializeAnalysis() {
    // Load the current date from storage
    const savedDate = localStorage.getItem('currentDate');
    if (savedDate) {
        currentDate = savedDate;
    }
    currentDayDisplay.textContent = formatDisplayDate(currentDate);
    
    // Load all logs and get the logs for the current date only
    const timeLogs = JSON.parse(localStorage.getItem('timeLogs')) || {};
    const timeSpentOnDate = timeLogs[currentDate] || {};

    // --- Process Data for Chart ---
    const labels = [];
    const data = [];
    let totalTimeSpentMs = 0;

    for (const category in timeSpentOnDate) {
        if (timeSpentOnDate[category] > 0) {
            labels.push(category);
            data.push(timeSpentOnDate[category]);
            totalTimeSpentMs += timeSpentOnDate[category];
        }
    }

    const totalDayMs = TOTAL_DAY_HOURS * 3600 * 1000;
    const timeLeftMs = totalDayMs - totalTimeSpentMs;

    if (timeLeftMs > 0 || totalTimeSpentMs === 0) {
        labels.push("Time Remaining in Day");
        data.push(timeLeftMs < 0 ? 0 : timeLeftMs); // Ensure it doesn't go negative
    }

    // Update summary text
    analysisSummary.textContent = `You have tracked a total of ${formatDuration(totalTimeSpentMs)} on this day.`;

    // --- Create Chart ---
    new Chart(chartCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Time',
                data: data,
                backgroundColor: ['#007BFF', '#4CAF50', '#f44336', '#ffc107', '#673ab7', '#e91e63', '#dddddd'],
                borderColor: '#1e1e1e',
                borderWidth: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { color: '#fff', padding: 20, font: { size: 14 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const ms = context.raw;
                            return `${context.label}: ${formatDuration(ms)}`;
                        }
                    }
                }
            }
        }
    });
}

// --- START THE APP ---
initializeAnalysis();