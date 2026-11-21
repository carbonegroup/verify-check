#!/usr/bin/env bash
set -euo pipefail

# Configuration - UPDATE THESE VALUES
GITHUB_REPO="sudomarc/verify-check"  # Change to your GitHub repo (owner/repo)
GITHUB_PAGES_URL="https://sudomarc.github.io/verify-check"  # Or custom domain if configured
APK_FILENAME="verifycheck-latest.apk"
DOWNLOAD_DIR="${HOME}/Downloads"
APK_PATH="${DOWNLOAD_DIR}/${APK_FILENAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Check if adb is available
check_adb() {
    if ! command -v adb &> /dev/null; then
        log_error "adb not found in PATH. Please install Android Platform Tools."
        log_info "On Ubuntu/Debian: sudo apt install android-tools-adb"
        log_info "On macOS: brew install android-platform-tools"
        log_info "On Windows: Download from https://developer.android.com/studio/releases/platform-tools"
        exit 1
    fi

    # Check for connected devices
    DEVICES=$(adb devices | grep -v "List of devices" | grep -v "^$" | grep "device$" | wc -l)
    if [ "$DEVICES" -eq 0 ]; then
        log_error "No Android device connected via ADB."
        log_info "Enable USB debugging on your phone and connect via USB."
        log_info "Run 'adb devices' to verify connection."
        exit 1
    elif [ "$DEVICES" -gt 1 ]; then
        log_warn "Multiple devices connected. Using the first one."
        adb devices
    fi
    log_success "ADB ready with $(adb devices | grep "device$" | head -1 | awk '{print $1}')"
}

# Download APK from GitHub Pages
download_apk() {
    local url="${GITHUB_PAGES_URL}/${APK_FILENAME}"
    log_info "Downloading APK from: $url"

    mkdir -p "$DOWNLOAD_DIR"

    if curl -L -f -o "$APK_PATH" "$url"; then
        local size=$(stat -c%s "$APK_PATH" 2>/dev/null || stat -f%z "$APK_PATH" 2>/dev/null)
        log_success "Downloaded APK (${size} bytes) to $APK_PATH"
    else
        log_error "Failed to download APK from $url"
        log_info "Check if GitHub Pages is enabled and the workflow has run successfully."
        log_info "Visit: https://github.com/${GITHUB_REPO}/actions"
        exit 1
    fi
}

# Install APK via ADB
install_apk() {
    log_info "Installing APK on device..."

    # Uninstall existing version first (optional, but cleaner)
    log_info "Checking for existing installation..."
    if adb shell pm list packages | grep -q "verifycheck"; then
        log_warn "Existing VerifyCheck app found. Uninstalling first..."
        adb uninstall com.verifycheck.mobile 2>/dev/null || true
    fi

    # Install the new APK
    if adb install -r "$APK_PATH"; then
        log_success "APK installed successfully!"
    else
        log_error "Failed to install APK"
        log_info "Make sure 'Install unknown apps' is enabled for ADB/file manager on your device."
        exit 1
    fi
}

# Launch the app after install
launch_app() {
    log_info "Launching VerifyCheck..."
    adb shell am start -n com.verifycheck.mobile/.MainActivity 2>/dev/null || \
    adb shell monkey -p com.verifycheck.mobile -c android.intent.category.LAUNCHER 1 2>/dev/null || \
    log_warn "Could not auto-launch app. Please open it manually from your app drawer."
}

# Main
main() {
    echo "========================================"
    echo "  VerifyCheck APK Download & Install"
    echo "========================================"
    echo ""

    check_adb
    download_apk
    install_apk
    launch_app

    echo ""
    log_success "Done! VerifyCheck should now be installed on your device."
}

main "$@"