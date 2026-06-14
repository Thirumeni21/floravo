# Contributing to Floravo 🌷

**Thank you for being here.**

Floravo started as a small idea between friends and has grown into an open-source project dedicated to meaningful digital gifting — through flowers, photos, voice notes, and personal messages. Every contribution, no matter the size, helps this grow into something more.

Whether you're squashing a bug, polishing animations, improving documentation, or building something new — you're welcome here.

---

## Before You Begin

Please take a moment to:

- Browse existing [Issues](../../issues) and [Discussions](../../discussions) before starting
- Search to see if your idea or bug has already been raised
- **Open an issue first** for larger changes — a quick conversation upfront saves everyone time

For small fixes (typos, broken links, minor corrections), feel free to open a pull request directly.

---

## Repository Structure

Floravo is a monorepo with separate frontend and backend packages.

```
floravo/
├── frontend/          # Next.js application
├── server/            # Express API + MongoDB backend
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── LICENSE
```

### Frontend — `frontend/`

| Technology | Role |
|---|---|
| Next.js + React | Application framework |
| Tailwind CSS | Styling |
| Firebase Authentication | Auth |

Covers: Bouquet Builder, Recipient Experience, Animations, Canvas Rendering.

### Backend — `server/`

| Technology | Role |
|---|---|
| Express.js | API server |
| MongoDB Atlas | Database |
| Firebase Admin SDK | Auth management |

Covers: User Management, Approval System, Bouquet Persistence, Share Links, Admin Features.

---

## What We're Looking For

Contributions actively welcomed:

- Bug fixes
- Performance improvements
- Accessibility improvements
- Frontend polish and animations
- Backend API improvements
- MongoDB schema improvements
- Firebase authentication improvements
- Mobile responsiveness
- Documentation updates and corrections
- Testing improvements
- New bouquet assets and flower packs

### Please Discuss First

The following require an open issue and maintainer sign-off before implementation:

- Complete redesigns of the Floravo visual identity
- Replacing core technologies (Next.js, Firebase, MongoDB)
- Large architectural rewrites
- Features requiring significant frontend and backend changes

> The parchment-inspired visual aesthetic is intentional. UI proposals should respect and extend it, not replace it.

---

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/floravo.git
cd floravo
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd ../server && npm install
```

### 3. Configure Environment Variables

```bash
# Frontend
cp frontend/.env.example frontend/.env.local

# Backend
cp server/.env.example server/.env
```

Fill in the required Firebase and MongoDB credentials in each file.

### 4. Run Development Servers

```bash
# Frontend (in one terminal)
cd frontend && npm run dev

# Backend (in another terminal)
cd server && npm run dev
```

---

## Contribution Workflow

```
Fork the repo
     ↓
Create a branch
     ↓
Make your changes
     ↓
Open a pull request
     ↓
Review & feedback
     ↓
Merged ✓
```

---

## Branch Naming

Use the format `type/short-description`:

| Prefix | When to use |
|---|---|
| `fix/` | Bug fixes |
| `feat/` | New features |
| `docs/` | Documentation only |
| `chore/` | Maintenance, dependencies |

**Examples:**

```
fix/share-link-generation
fix/mobile-layout-overflow
feat/custom-flower-pack
feat/recipient-animation
docs/update-setup-guide
chore/update-dependencies
```

---

## Commit Style

Keep commits concise and descriptive. A good commit message completes the sentence: *"This commit will…"*

**Good:**
```
fix bouquet save failure
add lily flower asset
improve mobile layout
update deployment guide
```

**Avoid:**
```
WIP
final final fix
asdf
```

Squash unnecessary commits before opening a pull request.

---

## Opening a Pull Request

When submitting a PR, include:

- **What** changed
- **Why** it changed
- **How** it was tested
- A link to any related issues (e.g. `Closes #42`)

Visual changes should include **screenshots or a short screen recording**.

---

## Adding Flower Assets

New flower assets should:

- Match the existing hand-illustrated visual style
- Use transparent backgrounds (PNG)
- Be consistent in scale with existing assets
- Use lowercase, hyphenated filenames

**Examples:**
```
garden-dahlia.png
white-lily.png
pink-peony.png
```

Include screenshots in your PR showing how the flower appears within an arrangement.

---

## Design Guidelines

Floravo follows a **vintage correspondence aesthetic** — warm, intimate, and unhurried.

When contributing UI changes:

- Use existing design tokens and Tailwind variables
- Maintain the parchment-inspired visual feel
- Keep interactions elegant and restrained
- Avoid introducing unrelated design systems or visual frameworks

**Core visual principles:**

| Principle | Description |
|---|---|
| Warm tones | Parchment-inspired palette |
| Typography | Elegant, readable, classic |
| Motion | Subtle animations only |
| Density | Minimal visual clutter |
| Tone | Personal and sentimental |

Consistency is valued over novelty.

---

## Reporting Bugs

A reproducible bug is much easier to fix. When reporting, please include:

- What happened
- What you expected to happen
- Steps to reproduce
- Browser and operating system
- Screenshots (if applicable)
- Console errors (if relevant)

---

## Security

**Never include in issues or pull requests:**

- Firebase credentials
- MongoDB connection strings
- API keys or secrets
- Private user data

If you discover a security vulnerability, please contact the maintainers privately rather than opening a public issue.

---

## First Contribution?

Look for issues tagged:

```
good first issue
help wanted
documentation
```

New contributors are always welcome. Questions are encouraged — no question is too small.

---

## Code of Conduct

- Be respectful and assume good intent
- Give constructive feedback
- Remember: feedback on code is not feedback on the person

We're here to build something meaningful together. For full details, see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

---

## Thank You

Every contribution — a bug fix, a new feature, a design suggestion, a documentation correction, or a question in Discussions — helps Floravo become something better.

Thank you for being part of it. 🌷
