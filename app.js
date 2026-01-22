// Constants
const STATE_KEY = 'invites_state_v1';
const ORGANIZER_PASSWORD = 'admin';

// Global state
let currentTab = 'event';
let hostUnlocked = false;
let reminderCheckInterval = null;

// State management
function seedState() {
  return {
    event: {
      title: 'Dinner Plan',
      description: 'Vote on the time and place. After it locks, confirm if you\'re going.',
      timezone: 'America/Chicago',
      startAtISO: null,
      endAtISO: null
    },
    locked: false,
    organizer: {
      lockedAt: null,
      lockedTimeId: null,
      lockedLocationId: null
    },
    host: {
      pass: 'admin',
      reminders: []
    },
    options: {
      times: [
        { id: 't1', label: 'Fri 7:00 PM' },
        { id: 't2', label: 'Sat 1:00 PM' },
        { id: 't3', label: 'Sun 11:00 AM' }
      ],
      locations: [
        { id: 'l1', label: 'Ramen Tatsu-Ya' },
        { id: 'l2', label: 'Home Poker Night' },
        { id: 'l3', label: 'Zilker Picnic' }
      ]
    },
    votes: {},
    rsvps: {}
  };
}

function migrateState(state) {
  // Ensure event has new fields
  if (!state.event.timezone) {
    state.event.timezone = 'America/Chicago';
  }
  if (!state.event.hasOwnProperty('startAtISO')) {
    state.event.startAtISO = null;
  }
  if (!state.event.hasOwnProperty('endAtISO')) {
    state.event.endAtISO = null;
  }

  // Ensure host object exists
  if (!state.host) {
    state.host = {
      pass: 'admin',
      reminders: []
    };
  }
  if (!state.host.reminders) {
    state.host.reminders = [];
  }

  // Migrate organizer fields to event if locked
  if (state.locked && state.organizer) {
    if (!state.event.startAtISO && state.organizer.lockedAt) {
      // Set default start time to 1 week from lock time
      const defaultStart = new Date(state.organizer.lockedAt + 7 * 24 * 60 * 60 * 1000);
      state.event.startAtISO = defaultStart.toISOString();
      const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);
      state.event.endAtISO = defaultEnd.toISOString();
    }
  }

  return state;
}

function loadState() {
  try {
    const stored = localStorage.getItem(STATE_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      return migrateState(state);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return seedState();
}

function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// Utility functions
function normalizeName(name) {
  return name.trim().toLowerCase();
}

function computeTallies(state) {
  const timeCounts = {};
  const locationCounts = {};

  // Initialize counts
  state.options.times.forEach(t => {
    timeCounts[t.id] = 0;
  });
  state.options.locations.forEach(l => {
    locationCounts[l.id] = 0;
  });

  // Count votes
  Object.values(state.votes).forEach(vote => {
    if (vote.timeId && timeCounts.hasOwnProperty(vote.timeId)) {
      timeCounts[vote.timeId]++;
    }
    if (vote.locationId && locationCounts.hasOwnProperty(vote.locationId)) {
      locationCounts[vote.locationId]++;
    }
  });

  const totalVoters = Object.keys(state.votes).length;

  return { timeCounts, locationCounts, totalVoters };
}

function computeWinners(state) {
  const { timeCounts, locationCounts } = computeTallies(state);

  // Find winner by highest count, ties break by array order
  let winningTimeId = state.options.times[0].id;
  let maxTimeCount = timeCounts[winningTimeId];

  state.options.times.forEach(t => {
    if (timeCounts[t.id] > maxTimeCount) {
      maxTimeCount = timeCounts[t.id];
      winningTimeId = t.id;
    }
  });

  let winningLocationId = state.options.locations[0].id;
  let maxLocationCount = locationCounts[winningLocationId];

  state.options.locations.forEach(l => {
    if (locationCounts[l.id] > maxLocationCount) {
      maxLocationCount = locationCounts[l.id];
      winningLocationId = l.id;
    }
  });

  return { timeId: winningTimeId, locationId: winningLocationId };
}

// Tab management
function setActiveTab(tabId) {
  currentTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update tab panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });

  // Re-render content for the active tab
  render();
}

// Reminder processing
function processScheduledReminders(state) {
  const now = Date.now();
  let updated = false;

  state.host.reminders.forEach(reminder => {
    if (!reminder.sent && reminder.sendAtISO) {
      const sendTime = new Date(reminder.sendAtISO).getTime();
      if (sendTime <= now) {
        reminder.sent = true;
        updated = true;
      }
    }
  });

  if (updated) {
    saveState(state);
  }

  return updated;
}

// ICS generation
function generateICS(state) {
  const startISO = state.event.startAtISO;
  const endISO = state.event.endAtISO;

  if (!startISO) {
    return null;
  }

  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date(start.getTime() + 60 * 60 * 1000);

  // Format dates as YYYYMMDDTHHMMSS
  const formatICSDate = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  };

  const timeLabel = state.options.times.find(t => t.id === state.organizer.lockedTimeId)?.label || '';
  const locationLabel = state.options.locations.find(l => l.id === state.organizer.lockedLocationId)?.label || '';

  const now = new Date();
  const dtstamp = formatICSDate(now);
  const dtstart = formatICSDate(start);
  const dtend = formatICSDate(end);

  // Generate UID
  const uid = `invites-${state.event.title.toLowerCase().replace(/\s+/g, '-')}-${state.organizer.lockedAt}@invites-mvp`;

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Invites MVP//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${state.event.title}
LOCATION:${locationLabel}
DESCRIPTION:${state.event.description}\\n\\nTime: ${timeLabel}\\nLocation: ${locationLabel}
END:VEVENT
END:VCALENDAR`;

  return ics;
}

// File download
function downloadTextFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Rendering
function render() {
  const state = loadState();

  // Process scheduled reminders
  processScheduledReminders(state);

  // Render header (always visible)
  renderHeader(state);

  // Render content based on active tab
  if (currentTab === 'event') {
    renderEventTab(state);
  } else if (currentTab === 'results') {
    renderResultsSection(state);
  } else if (currentTab === 'calendar') {
    renderCalendarTab(state);
  } else if (currentTab === 'host') {
    renderHostTab(state);
  }
}

function renderEventTab(state) {
  renderLockedPlan(state);
  renderVotingSection(state);
  renderRSVPSection(state);
  renderRemindersDisplay(state);
}

function renderHeader(state) {
  const header = document.getElementById('header');

  const html = `
    <div class="section">
      <h1>${escapeHtml(state.event.title)}</h1>
      <p>${escapeHtml(state.event.description)}</p>
    </div>
  `;

  header.innerHTML = html;
}

function renderLockedPlan(state) {
  const section = document.getElementById('locked-plan-section');

  if (!state.locked) {
    section.innerHTML = '';
    return;
  }

  const timeLabel = state.options.times.find(t => t.id === state.organizer.lockedTimeId)?.label || '';
  const locationLabel = state.options.locations.find(l => l.id === state.organizer.lockedLocationId)?.label || '';
  const lockedDate = new Date(state.organizer.lockedAt);

  const html = `
    <div class="section">
      <div class="locked-card">
        <h2>🔒 Locked Plan</h2>
        <div class="locked-details"><strong>Time:</strong> ${escapeHtml(timeLabel)}</div>
        <div class="locked-details"><strong>Location:</strong> ${escapeHtml(locationLabel)}</div>
        <div class="locked-time">Locked on ${lockedDate.toLocaleString()}</div>
      </div>
    </div>
  `;

  section.innerHTML = html;
}

function renderVotingSection(state) {
  const section = document.getElementById('voting-section');

  if (state.locked) {
    section.innerHTML = '';
    return;
  }

  let html = `
    <h2>Cast Your Vote</h2>
    <form id="vote-form">
      <div class="form-group">
        <label for="voter-name">Your Name</label>
        <input type="text" id="voter-name" placeholder="Enter your name" required>
      </div>

      <div class="form-group">
        <label>Select a Time</label>
        <div class="radio-group">
  `;

  state.options.times.forEach(time => {
    html += `
      <div class="radio-option">
        <input type="radio" id="time-${time.id}" name="time" value="${time.id}" required>
        <label for="time-${time.id}">${escapeHtml(time.label)}</label>
      </div>
    `;
  });

  html += `
        </div>
      </div>

      <div class="form-group">
        <label>Select a Location</label>
        <div class="radio-group">
  `;

  state.options.locations.forEach(location => {
    html += `
      <div class="radio-option">
        <input type="radio" id="location-${location.id}" name="location" value="${location.id}" required>
        <label for="location-${location.id}">${escapeHtml(location.label)}</label>
      </div>
    `;
  });

  html += `
        </div>
      </div>

      <button type="submit" class="btn btn-primary">Submit Vote</button>
      <div id="vote-message"></div>
    </form>
  `;

  section.innerHTML = html;

  // Attach form handler
  document.getElementById('vote-form').addEventListener('submit', handleVoteSubmit);
}

function renderResultsSection(state) {
  const content = document.getElementById('results-content');
  const { timeCounts, locationCounts, totalVoters } = computeTallies(state);

  let html = `
    <div class="total-voters">Total Voters: ${totalVoters}</div>
    <div class="results-grid">
      <div class="results-category">
        <h4>Time Preferences</h4>
  `;

  state.options.times.forEach(time => {
    const count = timeCounts[time.id];
    const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;

    html += `
      <div class="tally-item">
        <div class="tally-label">${escapeHtml(time.label)}</div>
        <div class="tally-bar">
          <div class="tally-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="tally-count">${count} vote${count !== 1 ? 's' : ''} (${percentage}%)</div>
      </div>
    `;
  });

  html += `
      </div>
      <div class="results-category">
        <h4>Location Preferences</h4>
  `;

  state.options.locations.forEach(location => {
    const count = locationCounts[location.id];
    const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;

    html += `
      <div class="tally-item">
        <div class="tally-label">${escapeHtml(location.label)}</div>
        <div class="tally-bar">
          <div class="tally-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="tally-count">${count} vote${count !== 1 ? 's' : ''} (${percentage}%)</div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  content.innerHTML = html;
}

function renderRSVPSection(state) {
  const section = document.getElementById('rsvp-section');

  if (!state.locked) {
    section.innerHTML = '';
    return;
  }

  let html = `
    <h2>RSVP</h2>
    <form id="rsvp-form">
      <div class="form-group">
        <label for="rsvp-name">Your Name</label>
        <input type="text" id="rsvp-name" placeholder="Enter your name" required>
      </div>

      <div class="rsvp-controls">
        <button type="submit" name="status" value="going" class="btn btn-success">I'm Going</button>
        <button type="submit" name="status" value="notGoing" class="btn btn-danger">Not Going</button>
      </div>

      <div id="rsvp-message"></div>
    </form>

    <div class="attendee-list">
      <h4>Attendees</h4>
  `;

  const going = Object.entries(state.rsvps)
    .filter(([_, rsvp]) => rsvp.status === 'going')
    .map(([name, _]) => name);

  html += `<div class="attendee-count">${going.length} going</div>`;

  if (going.length > 0) {
    html += '<ul>';
    going.forEach(name => {
      html += `<li>${escapeHtml(name)}</li>`;
    });
    html += '</ul>';
  } else {
    html += '<p style="color: #718096; font-style: italic;">No one has confirmed yet</p>';
  }

  html += '</div>';

  section.innerHTML = html;

  // Attach RSVP handlers
  const rsvpForm = document.getElementById('rsvp-form');
  rsvpForm.addEventListener('submit', handleRSVPSubmit);
}

function renderRemindersDisplay(state) {
  const section = document.getElementById('reminders-section');

  // Get sent reminders
  const sentReminders = state.host.reminders.filter(r => r.sent).sort((a, b) => b.createdAt - a.createdAt);

  if (sentReminders.length === 0) {
    section.innerHTML = '';
    return;
  }

  let html = `
    <div class="reminders-display">
      <h3>📢 Announcements</h3>
  `;

  sentReminders.forEach(reminder => {
    const createdDate = new Date(reminder.createdAt);
    html += `
      <div class="reminder-display-item">
        <div class="reminder-display-time">${createdDate.toLocaleString()}</div>
        <div class="reminder-display-message">${escapeHtml(reminder.message)}</div>
      </div>
    `;
  });

  html += `
    <div class="last-updated">Last updated: ${new Date().toLocaleString()}</div>
    </div>
  `;

  section.innerHTML = html;
}

function renderCalendarTab(state) {
  const content = document.getElementById('calendar-content');

  if (!state.locked) {
    content.innerHTML = '<div class="calendar-not-locked">📅 Calendar will be available after the plan is locked.</div>';
    return;
  }

  const timeLabel = state.options.times.find(t => t.id === state.organizer.lockedTimeId)?.label || '';
  const locationLabel = state.options.locations.find(l => l.id === state.organizer.lockedLocationId)?.label || '';

  const startDate = state.event.startAtISO ? new Date(state.event.startAtISO).toLocaleString() : 'Not set';
  const endDate = state.event.endAtISO ? new Date(state.event.endAtISO).toLocaleString() : 'Not set';

  let html = `
    <div class="calendar-summary">
      <h3>${escapeHtml(state.event.title)}</h3>
      <div class="calendar-detail"><strong>Time:</strong> ${escapeHtml(timeLabel)}</div>
      <div class="calendar-detail"><strong>Location:</strong> ${escapeHtml(locationLabel)}</div>
      <div class="calendar-detail"><strong>Start:</strong> ${startDate}</div>
      <div class="calendar-detail"><strong>End:</strong> ${endDate}</div>
      <div class="calendar-actions">
        <button id="download-ics-btn" class="btn btn-primary" ${!state.event.startAtISO ? 'disabled' : ''}>Download .ics</button>
        <button id="copy-event-btn" class="btn btn-secondary">Copy Event Details</button>
      </div>
    </div>
  `;

  if (!state.event.startAtISO) {
    html += '<p style="color: #718096; font-style: italic; text-align: center;">Host needs to set event date/time in the Host tab before calendar download is available.</p>';
  }

  content.innerHTML = html;

  // Attach handlers
  if (state.event.startAtISO) {
    document.getElementById('download-ics-btn').addEventListener('click', () => handleDownloadICS(state));
  }
  document.getElementById('copy-event-btn').addEventListener('click', () => handleCopyEvent(state));
}

function renderHostTab(state) {
  const content = document.getElementById('host-content');

  let html = `
    <div class="host-login">
      <div class="form-group">
        <label for="host-password">Host Password</label>
        <input type="password" id="host-password" placeholder="Enter host password">
      </div>
      <button id="host-unlock-btn" class="btn btn-primary">Unlock Host Controls</button>
      <p class="organizer-error" id="host-error"></p>
    </div>
  `;

  if (hostUnlocked) {
    // Event datetime editing
    const startValue = state.event.startAtISO ? new Date(state.event.startAtISO).toISOString().slice(0, 16) : '';
    const endValue = state.event.endAtISO ? new Date(state.event.endAtISO).toISOString().slice(0, 16) : '';

    html += `
      <div class="event-datetime-edit">
        <h3>Event Date & Time</h3>
        <form id="datetime-form">
          <div class="datetime-grid">
            <div class="form-group">
              <label for="event-start">Start</label>
              <input type="datetime-local" id="event-start" value="${startValue}">
            </div>
            <div class="form-group">
              <label for="event-end">End</label>
              <input type="datetime-local" id="event-end" value="${endValue}">
            </div>
          </div>
          <button type="submit" class="btn btn-primary">Save Date & Time</button>
        </form>
      </div>

      <div class="reminder-form">
        <h3>Create Reminder</h3>
        <form id="reminder-form">
          <div class="form-group">
            <label for="reminder-message">Message</label>
            <textarea id="reminder-message" rows="3" placeholder="Enter reminder message" required style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; background: #fafbfc; font-family: inherit;"></textarea>
          </div>
          <div class="form-group">
            <label for="reminder-sendAt">Send At (optional - leave blank to send immediately)</label>
            <input type="datetime-local" id="reminder-sendAt">
          </div>
          <button type="submit" class="btn btn-primary">Create Reminder</button>
          <div id="reminder-message-feedback"></div>
        </form>
      </div>
    `;
  }

  // Reminder list (visible to everyone, but full controls only when unlocked)
  html += '<div class="reminder-list"><h3>Reminders</h3>';

  if (state.host.reminders.length === 0) {
    html += '<p style="color: #718096; font-style: italic;">No reminders yet</p>';
  } else {
    const reminders = hostUnlocked
      ? state.host.reminders.sort((a, b) => b.createdAt - a.createdAt)
      : state.host.reminders.filter(r => r.sent).sort((a, b) => b.createdAt - a.createdAt);

    reminders.forEach(reminder => {
      const isSent = reminder.sent || (!reminder.sendAtISO);
      const badge = isSent ? 'sent' : 'scheduled';
      const badgeText = isSent ? 'Sent' : 'Scheduled';
      const createdDate = new Date(reminder.createdAt);
      const sendDate = reminder.sendAtISO ? new Date(reminder.sendAtISO) : null;

      html += `
        <div class="reminder-item ${badge}">
          <div class="reminder-header">
            <span class="reminder-badge ${badge}">${badgeText}</span>
            <span style="font-size: 13px; color: #718096;">${createdDate.toLocaleString()}</span>
          </div>
          <div class="reminder-message">${escapeHtml(reminder.message)}</div>
      `;

      if (sendDate && !isSent) {
        html += `<div class="reminder-time">Scheduled for: ${sendDate.toLocaleString()}</div>`;
      }

      if (hostUnlocked) {
        html += `
          <div class="reminder-actions">
        `;
        if (!isSent) {
          html += `<button class="btn btn-success" onclick="handleSendNow('${reminder.id}')">Send Now</button>`;
        }
        html += `
            <button class="btn btn-danger" onclick="handleDeleteReminder('${reminder.id}')">Delete</button>
          </div>
        `;
      }

      html += '</div>';
    });
  }

  html += '</div>';

  // Organizer controls (lock/reset)
  if (hostUnlocked) {
    html += `
      <div class="event-datetime-edit" style="margin-top: 20px;">
        <h3>Organizer Controls</h3>
        <div class="organizer-controls">
          <div class="form-group">
            <input type="password" id="organizer-password" placeholder="Organizer password" value="admin">
          </div>
          <button id="lock-btn" class="btn btn-primary" ${state.locked ? 'disabled' : ''}>Lock Plan</button>
          <button id="reset-btn" class="btn btn-secondary">Reset Demo</button>
        </div>
        <p class="organizer-error" id="organizer-error"></p>
      </div>
    `;
  }

  content.innerHTML = html;

  // Attach event listeners
  document.getElementById('host-unlock-btn').addEventListener('click', handleHostUnlock);

  if (hostUnlocked) {
    const datetimeForm = document.getElementById('datetime-form');
    if (datetimeForm) {
      datetimeForm.addEventListener('submit', handleSaveDatetime);
    }

    const reminderForm = document.getElementById('reminder-form');
    if (reminderForm) {
      reminderForm.addEventListener('submit', handleCreateReminder);
    }

    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn && !state.locked) {
      lockBtn.addEventListener('click', handleLockPlan);
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', handleResetDemo);
    }
  }
}

// Event handlers
function handleVoteSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('voter-name').value.trim();
  const timeId = document.querySelector('input[name="time"]:checked')?.value;
  const locationId = document.querySelector('input[name="location"]:checked')?.value;

  const messageDiv = document.getElementById('vote-message');

  if (!name) {
    messageDiv.innerHTML = '<div class="error">Please enter your name</div>';
    return;
  }

  if (!timeId || !locationId) {
    messageDiv.innerHTML = '<div class="error">Please select both a time and location</div>';
    return;
  }

  const state = loadState();
  const normalizedName = normalizeName(name);

  // Store with normalized key but preserve original name for display
  if (!state.votes[normalizedName]) {
    state.votes[normalizedName] = { displayName: name };
  } else {
    state.votes[normalizedName].displayName = name;
  }

  state.votes[normalizedName].timeId = timeId;
  state.votes[normalizedName].locationId = locationId;
  state.votes[normalizedName].updatedAt = Date.now();

  saveState(state);

  messageDiv.innerHTML = `<div class="confirmation">Vote recorded for ${escapeHtml(name)}!</div>`;

  // Re-render results
  renderResultsSection(state);

  // Clear form
  e.target.reset();

  // Clear message after 3 seconds
  setTimeout(() => {
    messageDiv.innerHTML = '';
  }, 3000);
}

function handleRSVPSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('rsvp-name').value.trim();
  const status = e.submitter.value;

  const messageDiv = document.getElementById('rsvp-message');

  if (!name) {
    messageDiv.innerHTML = '<div class="error">Please enter your name</div>';
    return;
  }

  const state = loadState();
  const normalizedName = normalizeName(name);

  state.rsvps[normalizedName] = {
    displayName: name,
    status: status,
    updatedAt: Date.now()
  };

  saveState(state);

  const statusText = status === 'going' ? 'confirmed as going' : 'marked as not going';
  messageDiv.innerHTML = `<div class="confirmation">${escapeHtml(name)} ${statusText}!</div>`;

  // Re-render RSVP section
  renderRSVPSection(state);

  // Clear form
  document.getElementById('rsvp-name').value = '';

  // Clear message after 3 seconds
  setTimeout(() => {
    messageDiv.innerHTML = '';
  }, 3000);
}

function handleLockPlan() {
  const password = document.getElementById('organizer-password').value;
  const errorDiv = document.getElementById('organizer-error');

  if (password !== ORGANIZER_PASSWORD) {
    errorDiv.textContent = 'Incorrect password';
    setTimeout(() => {
      errorDiv.textContent = '';
    }, 3000);
    return;
  }

  const state = loadState();

  if (state.locked) {
    errorDiv.textContent = 'Plan is already locked';
    setTimeout(() => {
      errorDiv.textContent = '';
    }, 3000);
    return;
  }

  const winners = computeWinners(state);

  state.locked = true;
  state.organizer.lockedAt = Date.now();
  state.organizer.lockedTimeId = winners.timeId;
  state.organizer.lockedLocationId = winners.locationId;

  saveState(state);

  // Clear password field
  document.getElementById('organizer-password').value = '';

  // Re-render everything
  render();
}

function handleResetDemo() {
  if (confirm('Are you sure you want to reset the demo? All data will be cleared.')) {
    const freshState = seedState();
    saveState(freshState);
    hostUnlocked = false;
    render();
  }
}

function handleHostUnlock() {
  const password = document.getElementById('host-password').value;
  const errorDiv = document.getElementById('host-error');

  if (password !== ORGANIZER_PASSWORD) {
    errorDiv.textContent = 'Incorrect password';
    setTimeout(() => {
      errorDiv.textContent = '';
    }, 3000);
    return;
  }

  hostUnlocked = true;
  errorDiv.textContent = '';
  render();
}

function handleSaveDatetime(e) {
  e.preventDefault();

  const start = document.getElementById('event-start').value;
  const end = document.getElementById('event-end').value;

  const state = loadState();

  if (start) {
    state.event.startAtISO = new Date(start).toISOString();
  }

  if (end) {
    state.event.endAtISO = new Date(end).toISOString();
  } else if (start) {
    // Default end to 1 hour after start
    const startDate = new Date(start);
    state.event.endAtISO = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
  }

  saveState(state);
  render();
}

function handleCreateReminder(e) {
  e.preventDefault();

  const message = document.getElementById('reminder-message').value.trim();
  const sendAt = document.getElementById('reminder-sendAt').value;
  const feedbackDiv = document.getElementById('reminder-message-feedback');

  if (!message) {
    feedbackDiv.innerHTML = '<div class="error">Please enter a message</div>';
    return;
  }

  const state = loadState();

  const reminder = {
    id: `r${Date.now()}`,
    createdAt: Date.now(),
    message: message,
    sendAtISO: sendAt ? new Date(sendAt).toISOString() : null,
    sent: !sendAt // If no sendAt, mark as sent immediately
  };

  state.host.reminders.push(reminder);
  saveState(state);

  feedbackDiv.innerHTML = '<div class="confirmation">Reminder created!</div>';
  e.target.reset();

  setTimeout(() => {
    feedbackDiv.innerHTML = '';
    render();
  }, 1500);
}

function handleSendNow(reminderId) {
  const state = loadState();
  const reminder = state.host.reminders.find(r => r.id === reminderId);

  if (reminder) {
    reminder.sent = true;
    reminder.sendAtISO = new Date().toISOString();
    saveState(state);
    render();
  }
}

function handleDeleteReminder(reminderId) {
  if (!confirm('Delete this reminder?')) {
    return;
  }

  const state = loadState();
  state.host.reminders = state.host.reminders.filter(r => r.id !== reminderId);
  saveState(state);
  render();
}

function handleDownloadICS(state) {
  const ics = generateICS(state);
  if (ics) {
    downloadTextFile('invites_event.ics', ics, 'text/calendar');
  }
}

function handleCopyEvent(state) {
  const timeLabel = state.options.times.find(t => t.id === state.organizer.lockedTimeId)?.label || '';
  const locationLabel = state.options.locations.find(l => l.id === state.organizer.lockedLocationId)?.label || '';
  const startDate = state.event.startAtISO ? new Date(state.event.startAtISO).toLocaleString() : 'Not set';
  const endDate = state.event.endAtISO ? new Date(state.event.endAtISO).toLocaleString() : 'Not set';

  const text = `${state.event.title}\n\n${state.event.description}\n\nTime: ${timeLabel}\nLocation: ${locationLabel}\nStart: ${startDate}\nEnd: ${endDate}`;

  navigator.clipboard.writeText(text).then(() => {
    alert('Event details copied to clipboard!');
  }).catch(() => {
    alert('Failed to copy to clipboard');
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initial render
  render();

  // Attach tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTab(btn.dataset.tab);
    });
  });

  // Start reminder check interval (every 30 seconds)
  reminderCheckInterval = setInterval(() => {
    const state = loadState();
    if (processScheduledReminders(state)) {
      render();
    }
  }, 30000);
});
