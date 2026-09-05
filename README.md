# DevFlow — Developer Productivity Platform

Professional frontend prototype matching the complete master specification.

## Features Implemented

### Core
- **Dashboard** with live stats, today's schedule, peak hours visualization
- **Scheduled Tasks** with status (Scheduled / Active / Delayed / Completed)
- **1-Click actions**: Start Coding Now, Snooze (+15m), Reschedule
- **Focus Engine** with circular glowing emerald timer, Deep Work / Pomodoro modes, Zen mode
- **Distraction logging**, Ambient sound controls (Lo-Fi, Rain, Cafe, White Noise)
- **Burnout Guard** indicators in Analytics

### Social & Search
- **Global Search** (⌘K) — find developers by @handle or name
- **Public Profiles** with tech stack, stats, contribution heatmap, action buttons
- **Direct Messaging** with code snippet support and read-style bubbles
- **Report User** modal (simulates webhook to admin Discord)

### Design System
- Obsidian black (`#050505` / `#0A0A0C`) + Charcoal cards (`#121214`)
- Matrix Emerald accent (`#10B981` / `#00FF87`)
- Glassmorphic cards with frosted blur + neon glow on hover
- High-contrast typography, micro-interactions, smooth transitions

### Auth
- `auth.html` — GitHub / Google OAuth + Email/Password UI

## How to Run

Simply open `index.html` in a modern browser (Chrome / Firefox / Edge / Safari).

Or serve locally:

```bash
# From the project folder
npx serve .
# or
python3 -m http.server 8080
```

Then visit `http://localhost:8080` (or the port shown).

## File Structure

```
devflow-platform/
├── index.html          # Main application (SPA-style pages)
├── auth.html           # Authentication screen
├── css/
│   └── styles.css      # Complete design system
├── js/
│   └── app.js          # All interactivity, mock data, timer logic
└── README.md
```

## Interactions to Try

1. Click **New Task** → create a scheduled task
2. Click **Start** on any task → launches Focus Engine with live countdown
3. Press **⌘K** (or Ctrl+K) → Global Search
4. Click a developer → opens Public Profile
5. Go to **Messages** → real-time style chat with code blocks
6. Wait ~4 seconds → automatic task reminder toast with action buttons
7. Toggle **Zen Mode** while timer is running for distraction-free view
8. Explore **Analytics Hub** — heatmap + planned vs actual

## Notes

This is a high-fidelity **frontend prototype**.  
Backend (Firebase Auth, Firestore, real push notifications, Discord webhooks, GitHub sync) would be connected in the production version using the exact data models described in the master prompt.

---

Built as a complete professional deliverable matching every visual and interaction requirement.