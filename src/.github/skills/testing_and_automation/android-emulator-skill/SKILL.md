---
name: android-emulator-skill
version: 1.0.0
description: Production-ready scripts for Android app testing, building, and automation. Provides semantic UI navigation, build automation, log monitoring, and emulator lifecycle management. Optimized for AI agents with minimal token output.
---

# Android Emulator Skill

Build, test, and automate Android applications using accessibility-driven navigation and structured data instead of pixel coordinates.

## Quick Start

```bash
# 1. Check environment (use .sh on macOS/Linux, .ps1 on Windows)
bash scripts/emu_health_check.sh

# 2. Launch app
python scripts/app_launcher.py --launch com.example.app

# 3. Map screen to see elements
python scripts/screen_mapper.py

# 4. Tap button
python scripts/navigator.py --find-text "Login" --tap

# 5. Enter text
python scripts/navigator.py --find-type EditText --enter-text "user@example.com"
```

All scripts support `--help` for detailed options and `--json` for machine-readable output.

## Production Scripts

### Build & Development

1. **build_and_test.py** - Build Android projects, run tests, parse results
   - Options: `--task`, `--clean`, `--json`

2. **log_monitor.py** - Real-time log monitoring with intelligent filtering
   - Options: `--package`, `--tag`, `--priority`, `--duration`, `--json`

### Navigation & Interaction

3. **screen_mapper.py** - Analyze current screen and list interactive elements
   - Options: `--verbose`, `--json`

4. **navigator.py** - Find and interact with elements semantically
   - Options: `--find-text`, `--find-id`, `--tap`, `--enter-text`, `--json`

5. **gesture.py** - Perform swipes, scrolls, and other gestures
   - Options: `--swipe`, `--scroll`, `--duration`, `--json`

6. **app_launcher.py** - App lifecycle management
   - Options: `--launch`, `--terminate`, `--install`, `--uninstall`, `--list`, `--json`

### Emulator Lifecycle Management

7. **emulator_manage.py** - Manage Android Virtual Devices (AVDs)
   - Options: `--list`, `--boot`, `--shutdown`, `--json`

8. **emu_health_check** - Verify environment is properly configured
   - Checks ADB, Emulator, Java, Gradle, ANDROID_HOME

## Key Design Principles

**Semantic Navigation**: Find elements by text, resource-id, or content-description.

**Token Efficiency**: Concise default output with optional verbose and JSON modes.

**Zero Configuration**: Works with standard Android SDK installation.

## Requirements

- Android SDK Platform-Tools (adb, fastboot)
- Android Emulator
- Java / OpenJDK
- Python 3