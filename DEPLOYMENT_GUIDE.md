# Step-by-Step Deployment Guide

## Step 1: Push Entire App to GitHub

### Option A: Using GitHub Desktop (Easier)

1. **Download GitHub Desktop** (if you don't have it): https://desktop.github.com/
2. **Open GitHub Desktop** → File → Add Local Repository
3. **Browse** to: `d:\Video_call_app_preeeeee\Video_call_app`
4. **Click** "Create a repository" if prompted
5. **Click** "Publish repository" button
6. **Name your repo** (e.g., `video-call-app`)
7. **Check** "Keep this code private" if you want (optional)
8. **Click** "Publish Repository"

### Option B: Using Command Line (Git Bash or PowerShell)

#### 1. Open Terminal/PowerShell
Navigate to your project:
```powershell
cd d:\Video_call_app_preeeeee\Video_call_app
```

#### 2. Initialize Git Repository (if not already done)
```powershell
git init
```

#### 3. Check Current Status
```powershell
git status
```
You should see both `client/` and `server/` folders listed.

#### 4. Stage All Files
```powershell
git add .
```

#### 5. Create Initial Commit
```powershell
git commit -m "Initial commit: Video Call App with Firebase"
```

#### 6. Create Repository on GitHub
- Go to https://github.com/new
- **Repository name**: `video-call-app` (or any name you prefer)
- **Description**: "WebRTC Video Call App with Firebase"
- Choose **Public** or **Private**
- **DO NOT** check "Initialize with README" (you already have files)
- Click **Create repository**

#### 7. Connect Local Repo to GitHub
Copy the commands GitHub shows you, or use these (replace `YOUR_USERNAME` with your GitHub username):

```powershell
git remote add origin https://github.com/YOUR_USERNAME/video-call-app.git
git branch -M main
git push -u origin main
```

#### 8. Verify Upload
- Go to your GitHub repository page
- You should see both `client/` and `server/` folders
- Check that `node_modules/` and `dist/` are NOT visible (they're ignored)

---

## What Gets Pushed?

✅ **Will be pushed:**
- `client/` folder (all source code)
- `server/` folder (all source code)
- `package.json` files
- Configuration files (`.gitignore`, `netlify.toml`, etc.)
- Source code files

❌ **Will NOT be pushed** (thanks to `.gitignore`):
- `node_modules/` folders
- `dist/` build folder
- `.env` files (if any)
- Log files
- OS-specific files

---

## Next Steps After Pushing to GitHub

1. **Deploy Server to Render** (uses `/server` subdirectory)
2. **Deploy Client to Netlify** (uses `/client` subdirectory)

Both platforms can deploy from subdirectories of the same repository!
