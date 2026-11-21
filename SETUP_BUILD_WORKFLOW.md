# VerifyCheck Build & Install Workflow Setup

## Overview

This setup provides a complete CI/CD pipeline that:
1. **Builds APK in the cloud** using EAS Build (Expo Application Services) — no local build required
2. **Deploys APK to GitHub Pages** for easy download
3. **Installs APK on your phone via ADB** with a single command

---

## Prerequisites

### 1. Expo Account & EAS Setup
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login
```

### 2. GitHub Repository Settings

#### Enable GitHub Pages
1. Go to Repository → Settings → Pages
2. Source: **GitHub Actions**
3. Save

#### Add Required Secrets (`Settings → Secrets and variables → Actions`)
| Secret | Value |
|--------|-------|
| `EXPO_TOKEN` | Get from `eas token:create` |

---

## Workflow Files Created

| File | Purpose |
|------|---------|
| `.github/workflows/build-apk.yml` | Builds APK via EAS, deploys to GitHub Pages |
| `.github/workflows/install-apk.yml` | (Optional) Install via self-hosted runner with ADB |
| `scripts/download-and-install-apk.sh` | **Main script** - Download from GitHub Pages & install via ADB |
| `mobile/eas.json` | EAS Build configuration |

---

## Step-by-Step Setup

### 1. Configure GitHub Pages URL

Edit `scripts/download-and-install-apk.sh` and update:
```bash
GITHUB_REPO="YOUR_USERNAME/YOUR_REPO"  # e.g., "marco/verify-check"
```

Your APK will be available at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO/verifycheck-latest.apk
```

### 2. Push Changes to GitHub
```bash
git add .
git commit -m "feat: add EAS build workflow + ADB install script"
git push origin main
```

### 3. Run First Build
Go to **Actions → Build APK and Deploy to GitHub Pages → Run workflow**
- Select build profile: `preview` (recommended for APK)
- Click **Run workflow**

Wait for completion (~10-15 minutes). The APK will be deployed to GitHub Pages.

---

## Installing on Your Phone

### Option 1: One-Command Install (Recommended)

```bash
# From the mobile directory
npm run install:apk
```

This will:
1. Check ADB connection
2. Download latest APK from GitHub Pages
3. Uninstall old version
4. Install new APK
5. Launch the app

### Option 2: Manual ADB Commands

```bash
# 1. Connect phone via USB with USB debugging enabled
adb devices

# 2. Download APK
curl -L -o verifycheck.apk https://YOUR_USERNAME.github.io/YOUR_REPO/verifycheck-latest.apk

# 3. Install
adb install -r verifycheck.apk

# 4. Launch
adb shell am start -n com.verifycheck.mobile/.MainActivity
```

---

## Build Profiles

| Profile | Output | Use Case |
|---------|--------|----------|
| `development` | APK | Development with dev client |
| `preview` | **APK** | **Testing on device (recommended)** |
| `production` | AAB | Play Store release |

---

## Troubleshooting

### "No device connected"
```bash
# Check connection
adb devices

# If unauthorized, accept prompt on phone
# If not listed: enable USB debugging, try different cable/port
```

### "Install unknown apps" error
On Android: Settings → Apps → Special access → Install unknown apps → Allow for your file manager/Chrome/ADB

### Build fails
- Check Actions logs for EAS errors
- Ensure `EXPO_TOKEN` secret is set correctly
- Run `eas build` locally once to verify config

### GitHub Pages 404
- Wait 2-3 minutes after workflow completes
- Check Actions → deploy job succeeded
- Verify Pages source is "GitHub Actions" in repo settings

---

## File Structure

```
├── .github/workflows/
│   ├── build-apk.yml      # Build & deploy to GitHub Pages
│   └── install-apk.yml    # (Optional) Runner-based install
├── mobile/
│   ├── eas.json           # EAS build config
│   └── package.json       # Added "install:apk" script
└── scripts/
    └── download-and-install-apk.sh  # Main install script
```

---

## Security Notes

- **Never commit `EXPO_TOKEN`** — only use GitHub Secrets
- APK on GitHub Pages is public — don't include sensitive keys in the app
- For private distribution, use EAS internal distribution or Play Store internal testing instead

---

## Next Steps

1. **Customize app ID** in `mobile/app.json` if needed
2. **Add signing credentials** for production: `eas credentials`
3. **Set up auto-build** on push to main (edit workflow triggers)
4. **Add version management** with `expo-application-version`