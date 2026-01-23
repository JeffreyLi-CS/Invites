# Invites+

A decision-first event planning web application that makes group coordination simple and efficient.

## Overview

Invites+ is a single-page static web application designed for collaborative event planning. Unlike traditional invite systems, Invites+ uses a **decision-first approach**: participants vote on times and locations first, the host locks in the winning options, and then everyone RSVPs to the finalized plan.

## Key Features

### 🔐 Global Authentication System
- **Phone number-based signup** - Sign up once with your name and phone number
- **Persistent login** - Stay logged in across all events you join or create
- **No re-authentication** - Switch between multiple events without logging in again

### 🎫 Multi-Event System
- **Unique Event IDs** - Each event gets a unique 6-character alphanumeric ID
- **Create unlimited events** - Any user can create as many events as they need
- **Easy joining** - Join events by entering the Event ID
- **Event ownership** - Only the event creator has access to host controls

### 🗳️ Decision-First Voting
- **Vote on options** - Participants vote on available times and locations
- **Live results** - See real-time voting results with visual progress bars
- **Democratic selection** - Host locks in the most popular options
- **RSVP after lock** - Final RSVP happens only after the plan is locked

### 👥 Collaborative Planning
- **Suggestion system** - All participants can suggest times and locations
- **Host approval** - Event creator reviews and approves suggestions
- **Equal participation** - Everyone contributes to planning, not just the host

### 📱 Text Reminder System
- **Instant or scheduled** - Send text reminders immediately or schedule for later
- **Message history** - Track all sent and scheduled messages
- **Automatic processing** - Scheduled reminders automatically send at the right time

### 📅 Event Calendar
- **Rich information cards** - View locked event details with time, location, and attendance
- **RSVP tracking** - See who's going and who's not
- **Copy to clipboard** - Easily share event details
- **Clean layout** - Color-coded cards for easy reading

### 🎨 Premium UI/UX
- **Purple gradient theme** - Modern, professional design
- **Responsive layout** - Works on all devices
- **Smooth animations** - Visual feedback for all interactions
- **Card-based design** - Organized, easy-to-scan interface

## How It Works

### 1. Sign Up / Sign In
- Create an account with your name and phone number
- Your account persists across all events

### 2. Create or Join Event
- **Create**: Generate a new Event ID and share it with participants
- **Join**: Enter an existing Event ID to join an event

### 3. Suggest & Vote
- Participants suggest times and locations
- Host approves suggestions to add them as voting options
- Everyone votes for their preferred time and location

### 4. Lock Plan
- Host reviews voting results
- Host locks in the winning time and location
- Event transitions to RSVP phase

### 5. RSVP & Attend
- Participants confirm if they're going or not
- Host can send text reminders to all participants
- View final attendance in the Calendar tab

## Technical Details

### Architecture
- **100% client-side** - No backend server required
- **Single-page application (SPA)** - Smooth navigation without page reloads
- **LocalStorage persistence** - All data stored in browser's localStorage
- **Static hosting compatible** - Works on GitHub Pages, Netlify, Vercel, etc.

### File Structure
```
├── index.html      # Main HTML structure with tab panels
├── styles.css      # Premium gradient theme and responsive styles
└── app.js          # Complete application logic and state management
```

### State Management
- **Global user state** - `invites_current_user` and `invites_global_users`
- **Per-event state** - `invites_event_{EVENT_ID}` for each event
- **Current event tracking** - `invites_current_event_id`
- **Backward compatibility** - Automatic state migration for older versions

### State Structure
```javascript
{
  eventId: "ABC123",
  ownerId: "5551234567",  // Event creator's phone number
  event: {
    title: "Invites+",
    description: "Vote on the time and place...",
    timezone: "America/Chicago",
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
    pass: "admin",
    users: [],      // Registered participants
    reminders: []   // Text message history
  },
  options: {
    times: [],      // Approved voting options
    locations: []
  },
  suggestions: {
    times: [],      // Pending suggestions
    locations: []
  },
  votes: {},        // User votes
  rsvps: {}         // Final RSVPs
}
```

## Feature Development History

### Version 1.0 - Initial Release
- Basic voting and RSVP system
- Single event support
- Host password authentication
- Premium gradient UI

### Version 2.0 - Multi-Event System
- Unique Event ID generation
- Create and join multiple events
- Event-specific localStorage keys
- Event ID display and sharing

### Version 3.0 - Global Authentication
- Phone number-based signup
- Global user persistence
- No re-login when switching events
- Automatic name filling

### Version 4.0 - Suggestion System
- Participants can suggest times/locations
- Host approval workflow
- Pending suggestions review

### Version 5.0 - Enhanced Calendar
- Rich information cards
- RSVP statistics display
- Copy event details feature
- Removed ICS download dependency

### Version 6.0 - Event Ownership (Current)
- Added `ownerId` field to track event creator
- Restricted host controls to event creator only
- Non-owners see option to create their own event
- Backward compatibility for existing events

### Version 6.1 - Clean Defaults
- Removed default times and locations
- Events start empty for clean slate
- Encourages custom options per event

## Setup

### Local Development
1. Clone the repository
2. Open `index.html` in your browser
3. Start creating events!

### GitHub Pages Deployment
1. Push code to GitHub repository
2. Go to Settings > Pages
3. Select branch and root directory
4. Your site will be live at `https://username.github.io/repo-name`

### Other Static Hosts
- **Netlify**: Drag and drop the folder
- **Vercel**: Connect GitHub repo
- **Cloudflare Pages**: Connect GitHub repo

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with localStorage support

## Data Privacy

- All data stored locally in your browser
- No data sent to external servers
- Clear browser data to reset everything

## Future Enhancements

Potential features for future development:
- Backend integration for true multi-device sync
- Real SMS integration via Twilio
- Email notifications
- Event archiving
- Participant permissions system
- Custom event themes
- Export to calendar apps

## License

MIT License - Feel free to use and modify for your needs.
