# 🧠 Meme Battle Dev Onboarding (Windows Edition)

Getting your friend in early on this project? Power move. Here’s the full step-by-step to get the meme battle app running locally on **Windows** with Git, PostgreSQL, Node, and all the bells and whistles.

---

## ✅ Setup Checklist (New Dev Flow)

---

### 🛠️ 1. GitHub + Git Setup

#### 🙋‍♂️ Your Friend

- Create a GitHub account: [github.com](https://github.com)
- Install Git for Windows: [git-scm.com/download/win](https://git-scm.com/download/win)
  - ✅ Select **“Git from the command line and also from 3rd-party software”** during setup

#### Generate SSH Key (in Git Bash or WSL):
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
```

Copy that key and add it to GitHub:

- GitHub → **Settings > SSH and GPG Keys > New SSH Key**

#### Set global Git config:
```bash
git config --global user.name "Your Name"
git config --global user.email "your_email@example.com"
```

---

### 🤝 2. Get Access to the Repo

#### 🧑‍💻 You (Gabe)

- Add your friend as a **collaborator** on the repo
- Create a dev branch for them (e.g. `dev-friend` or `sandbox-playground`)

---

### 💻 3. Clone the Project

```bash
# With SSH (preferred)
git clone git@github.com:your-username/your-repo-name.git

# Or HTTPS (fallback)
git clone https://github.com/your-username/your-repo-name.git

cd your-repo-name
```

---

### 🧠 4. Git Crash Course

```bash
git status            # Check what changed
git pull              # Get the latest from the repo
git add .             # Stage all your changes
git commit -m "msg"   # Save with a message
git push              # Push to GitHub

# Branching
git checkout -b my-feature   # Create + switch to branch
git checkout main            # Switch back to main
```

---

### 🐘 5. Install + Setup PostgreSQL

#### 🙋‍♂️ Your Friend (wait for Gabe to walk you through it)

- Download PostgreSQL: [enterprisedb.com/downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
- Set a password during install (save it!)
- If needed, use **pgAdmin** to reset the password

#### Create the DB:
```bash
psql -U postgres

# Then inside psql:
CREATE DATABASE uno_dev;
\q
```

#### Add a `.env` file (Gabe will send it):
```env
PORT=3000
NODE_ENV=development

DB_USER=uno_user
DB_HOST=localhost
DB_NAME=uno_dev
DB_PASSWORD=uno_password
DB_PORT=5432

SESSION_SECRET=your_secret_key
```

> ⚠️ **DO NOT** commit this file to GitHub

---

### 📦 6. Install Dependencies

- Install [Node.js LTS](https://nodejs.org/)
- Inside the project directory:
```bash
npm install
```

---

### ⚡ 7. Initialize Database Tables

From `MemeApp/` run:

```bash
# 1. Create DB + user + session + users table
psql -U postgres -f scripts/setup-db.sql

# 2. Add the meme features (starred memes, comments, likes)
psql -U uno_user -d uno_dev -f src/db/migrations/001_initial_setup.sql
```

> 🛠️ If permission errors pop up:
```bash
psql -U postgres -d uno_dev
GRANT CREATE ON SCHEMA public TO uno_user;
\q
```

---

### 🚀 8. Run the Project

```bash
# Start in dev mode (TypeScript watch + LiveReload)
npm run start:dev

# Or production mode (faster)
npm run start
```

---

### 🧳 9. Remote Server Access (Optional)

#### 🧑‍💻 Gabe

If you want him to push live:

- Share the server IP + SSH credentials privately
- Ask him to generate another SSH key if needed

```bash
# SSH into server
ssh user@your-server-ip

# Pull code + restart app
cd /path/to/project
git pull origin main
pm2 restart all
```

---

### 🧹 10. Final Cleanup + Dev Guidelines

#### 🙋‍♂️ Your Friend

- 🚫 **Avoid editing:**
  - `production.env`
  - `public/generated/*`

- ✅ Create a test branch to experiment
- 📝 Add a `HOW-TO-TEST.md` if you're doing sandbox work

---

## 🗂️ MemeApp Project Structure Breakdown

---

### 📁 `scripts/`
- `setup-db.sql` → Creates DB, user, and main session + users table.

---

### 📁 `src/` *(Main app code)*

- 📁 `assets/` → Place for icons, images, etc.
- 📁 `client/` → `main.ts`: Browser-side code compiled by Webpack.
- 📁 `config/`
  - `database.ts` → PostgreSQL connection pool
  - `livereload.ts` → Auto server reload
- 📁 `controllers/` → `auth.controller.ts`: Signup/login logic
- 📁 `db/migrations/` → `001_initial_setup.sql`: Meme features like reactions, comments, etc.
- 📁 `game/` → Meme templates + scoring logic
- 📁 `public/`
  - `memes/` → Raw meme templates
  - `generated/` → Final rendered memes
  - `uploads/` → User avatars
- 📁 `server/`
  - `middleware/` → Auth and upload middleware
  - `routes/` → Express endpoints: login, game logic, leaderboard, etc.
- 📁 `services/` → Core game + user logic (backend)
- 📁 `types/` → Custom TypeScript declarations
- 📁 `utils/` → Tools like `generateMemeImage.ts`

---

### 📁 `views/` *(EJS Templates)*

- `login.ejs`, `signup.ejs`, `game.ejs`, `profile.ejs`, etc.
- Rendered server-side for each page

---

### 📄 Root Files

- `.env` → Secrets + DB credentials
- `package.json` → Scripts + dependencies
- `tsconfig.json` → TypeScript config
- `webpack.config.ts` → Frontend build system
- `README.md` → You should drop this guide in here 👇