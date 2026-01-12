#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/app"
TMP_NAME="LexMessTmp"
FINAL_NAME="LexMess"

# Defaults used by the Android patcher. Keep them defined to avoid `set -u` crashes
# when the script is tweaked or run in stricter shells.
TMP_APP_ID="${TMP_APP_ID:-com.lexmesstmp}"
FINAL_PKG="${FINAL_PKG:-com.lexmess}"
NDK_VERSION="${NDK_VERSION:-26.1.10909125}"

export TMP_NAME FINAL_NAME TMP_APP_ID FINAL_PKG NDK_VERSION

# Patcher reads these variables.
export LEXMESS_TMP_NAME="$TMP_NAME"
export LEXMESS_TMP_PKG="$TMP_APP_ID"
export LEXMESS_FINAL_NAME="$FINAL_NAME"
export LEXMESS_FINAL_PKG="$FINAL_PKG"

RN_VERSION_DEFAULT="0.74.5"
RN_VERSION="${RN_VERSION:-$RN_VERSION_DEFAULT}"

ANDROID_PLATFORM_DEFAULT="34"
ANDROID_BUILD_TOOLS_DEFAULT="34.0.0"
MIN_SDK_DEFAULT="24"      # Android 7.0+ (нужно для react-native-webrtc)
TARGET_SDK_DEFAULT="34"

ANDROID_PLATFORM="${ANDROID_PLATFORM:-$ANDROID_PLATFORM_DEFAULT}"
ANDROID_BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-$ANDROID_BUILD_TOOLS_DEFAULT}"
MIN_SDK="${MIN_SDK:-$MIN_SDK_DEFAULT}"
TARGET_SDK="${TARGET_SDK:-$TARGET_SDK_DEFAULT}"

export ANDROID_PLATFORM ANDROID_BUILD_TOOLS MIN_SDK TARGET_SDK

# Keep init/tools stable.
BUNDLED_NODE_VER="20.19.4"
BUNDLED_NODE_DIR="${ROOT_DIR}/tools/node-${BUNDLED_NODE_VER}"

# Pin deps that recently changed upstream (avoid NitroModules on older RN templates).
AUDIO_RECORDER_PLAYER_VER="3.6.14"

log(){ echo "[lexmess-android] $*"; }
die(){ echo "[lexmess-android] ERROR: $*" >&2; exit 1; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"; }

maybe_install_apt(){
  if command -v apt-get >/dev/null 2>&1; then
    local pkgs=()
    for p in "$@"; do
      dpkg -s "$p" >/dev/null 2>&1 || pkgs+=("$p")
    done
    if ((${#pkgs[@]})); then
      for p in "${pkgs[@]}"; do log "Installing missing dependency via apt: ${p}"; done
      DEBIAN_FRONTEND=noninteractive apt-get update -y
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${pkgs[@]}"
    fi
  fi
}

setup_java(){
  maybe_install_apt openjdk-17-jdk
  if command -v javac >/dev/null 2>&1; then
    local javac_path
    javac_path="$(readlink -f "$(command -v javac)")"
    export JAVA_HOME
    JAVA_HOME="$(dirname "$(dirname "${javac_path}")")"
  elif command -v java >/dev/null 2>&1; then
    local java_path
    java_path="$(readlink -f "$(command -v java)")"
    export JAVA_HOME
    JAVA_HOME="$(dirname "$(dirname "${java_path}")")"
  else
    die "Java not found even after installing openjdk-17-jdk"
  fi
  log "JAVA_HOME=${JAVA_HOME}"
}

ensure_java_common_path(){
  # Some Gradle/tooling scans common JVM paths and may "detect" a non-existent
  # /usr/lib/jvm/openjdk-17, producing noisy warnings (or failures on some hosts).
  local want="/usr/lib/jvm/java-17-openjdk-amd64"
  local cur="/usr/lib/jvm/openjdk-17"
  if [[ -d "${want}" && ! -x "${cur}/bin/java" ]]; then
    if [[ -e "${cur}" && ! -L "${cur}" ]]; then
      mv "${cur}" "${cur}.bak_lexmess_$(date +%s)" 2>/dev/null || true
    else
      rm -f "${cur}" 2>/dev/null || true
    fi
    ln -sfn "${want}" "${cur}" 2>/dev/null || true
  fi
}

setup_node(){
  maybe_install_apt curl ca-certificates tar xz-utils
  mkdir -p "${ROOT_DIR}/tools"
  if [[ ! -x "${BUNDLED_NODE_DIR}/bin/node" ]]; then
    local url="https://nodejs.org/dist/v${BUNDLED_NODE_VER}/node-v${BUNDLED_NODE_VER}-linux-x64.tar.xz"
    log "Downloading Node from: ${url}"
    curl -fsSL "${url}" -o "${ROOT_DIR}/tools/node.tar.xz"
    # IMPORTANT: do not pre-create ${BUNDLED_NODE_DIR}, otherwise mv will nest the extracted folder
    rm -rf "${BUNDLED_NODE_DIR}" "${ROOT_DIR}/tools/node-v${BUNDLED_NODE_VER}-linux-x64" || true
    tar -xJf "${ROOT_DIR}/tools/node.tar.xz" -C "${ROOT_DIR}/tools"
    mv "${ROOT_DIR}/tools/node-v${BUNDLED_NODE_VER}-linux-x64" "${BUNDLED_NODE_DIR}"
    rm -f "${ROOT_DIR}/tools/node.tar.xz"
  fi

  export PATH="${BUNDLED_NODE_DIR}/bin:${PATH}"
  hash -r || true

  # Avoid interactive Corepack prompts (Yarn download) during init.
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  corepack disable >/dev/null 2>&1 || true

  local nv
  nv="$(node -v)"
  if [[ "${nv}" != "v${BUNDLED_NODE_VER}" ]]; then
    die "Failed to activate bundled Node v${BUNDLED_NODE_VER} (got ${nv}). Check PATH and ${BUNDLED_NODE_DIR}."
  fi
  log "Node now: ${nv}"
  log "npm  now: $(npm -v)"
}

detect_android_sdk(){
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "${ANDROID_SDK_ROOT}" ]]; then
    :
  elif [[ -n "${ANDROID_HOME:-}" && -d "${ANDROID_HOME}" ]]; then
    export ANDROID_SDK_ROOT="${ANDROID_HOME}"
  elif [[ -d "${HOME}/Android/Sdk" ]]; then
    export ANDROID_SDK_ROOT="${HOME}/Android/Sdk"
  elif [[ -d "/root/Android/Sdk" ]]; then
    export ANDROID_SDK_ROOT="/root/Android/Sdk"
  else
    die "ANDROID_SDK_ROOT/ANDROID_HOME not set and no default SDK found. Install Android SDK cmdline-tools."
  fi

  export ANDROID_HOME="${ANDROID_SDK_ROOT}"
  export PATH="${ANDROID_SDK_ROOT}/platform-tools:${PATH}"

  if [[ -d "${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin" ]]; then
    export PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${PATH}"
  elif [[ -d "${ANDROID_SDK_ROOT}/cmdline-tools/bin" ]]; then
    export PATH="${ANDROID_SDK_ROOT}/cmdline-tools/bin:${PATH}"
  else
    log "WARNING: Android cmdline-tools not found under ${ANDROID_SDK_ROOT}/cmdline-tools. sdkmanager may be missing."
  fi

  log "Detected Android SDK at: ${ANDROID_SDK_ROOT}"
}

ensure_android_components(){
  if command -v sdkmanager >/dev/null 2>&1; then
    log "Ensuring Android SDK components (platform ${TARGET_SDK}, build-tools ${ANDROID_BUILD_TOOLS})"
    yes | sdkmanager --licenses >/dev/null 2>&1 || true
    sdkmanager "platform-tools" \
      "platforms;android-${TARGET_SDK}" \
      "build-tools;${ANDROID_BUILD_TOOLS}" \
      "ndk;26.1.10909125" \
      "cmake;3.22.1" >/dev/null
    export ANDROID_NDK_HOME="${ANDROID_SDK_ROOT}/ndk/26.1.10909125"
    log "Using NDK: ${ANDROID_NDK_HOME}"
  else
    log "WARNING: sdkmanager not found. Skipping SDK component install."
  fi
}

ensure_swap(){
  # Gradle + Metro bundling can get OOM-killed on small VPS. Add swap if none.
  if command -v swapon >/dev/null 2>&1 && swapon --show | grep -q .; then
    return 0
  fi
  local mem_kb
  mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  # If RAM < 6GB, create a 6GB swapfile (temporary for build).
  if [[ "${mem_kb}" -lt 6000000 ]]; then
    local sf="/swapfile_lexmess"
    if [[ ! -f "${sf}" ]]; then
      log "Creating swapfile to prevent OOM (6G): ${sf}"
      (fallocate -l 6G "${sf}" 2>/dev/null || dd if=/dev/zero of="${sf}" bs=1M count=6144 status=none) || true
      chmod 600 "${sf}" || true
      mkswap "${sf}" >/dev/null 2>&1 || true
    fi
    swapon "${sf}" >/dev/null 2>&1 || true
  fi
}




init_or_reuse_rn_project(){
  if [[ -f "${APP_DIR}/package.json" && -d "${APP_DIR}/android" ]]; then
    log "Using existing app at: ${APP_DIR}"
    return 0
  fi

  maybe_install_apt git unzip
  rm -rf "${APP_DIR}" "${ROOT_DIR:?}/${TMP_NAME}" || true

  log "Initializing React Native project: ${TMP_NAME} (RN ${RN_VERSION})"

  # Ensure init happens under /opt/mobile (ROOT_DIR), not the caller's CWD (often /root)
  cd "${ROOT_DIR}"

  export CI=1
  export npm_config_yes=true

  set +e
  npx -y react-native@"${RN_VERSION}" init "${TMP_NAME}" \
    --version "${RN_VERSION}" \
    --skip-install \
    --skip-git-init \
    --pm npm \
    >/tmp/lexmess_rn_init.log 2>&1
  rc=$?
  set -e

  if [[ ! -f "${ROOT_DIR}/${TMP_NAME}/package.json" ]]; then
    log "React Native init log:"
    sed -n '1,240p' /tmp/lexmess_rn_init.log || true
    die "React Native init did not create package.json."
  fi

  if [[ "${rc}" -ne 0 ]]; then
    log "WARNING: react-native init returned ${rc}, but project files exist. Continuing."
  fi

  mv "${ROOT_DIR}/${TMP_NAME}" "${APP_DIR}"
  log "Created: ${APP_DIR}"
}

overlay_sources(){
  log "Overlaying LexMess sources into app/"
  rsync -a --delete --exclude "scripts" --exclude "tools" --exclude "legacy" \
    "${ROOT_DIR}/src/" "${APP_DIR}/src/"
  cp -f "${ROOT_DIR}/index.js" "${APP_DIR}/index.js"
  cp -f "${ROOT_DIR}/app.json" "${APP_DIR}/app.json"
  # Force app component name + label
  node -e "const fs=require('fs');const p='${APP_DIR}/app.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.name='${FINAL_NAME}';j.displayName='${FINAL_NAME}';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"
}

install_js_deps(){
  log "Installing JS dependencies"
  cd "${APP_DIR}"
  # Ensure we don't keep an incompatible lockfile/node_modules from earlier runs.
  rm -rf node_modules package-lock.json || true

  # npm 10+ is strict about peer deps; try normal install, then fall back if needed.
  set +e
  npm install --no-audit --no-fund
  local rc=$?
  set -e
  if [[ "$rc" -ne 0 ]]; then
    log "npm install failed (rc=${rc}); retrying with --legacy-peer-deps"
    npm install --no-audit --no-fund --legacy-peer-deps
  fi

    # Install EXACT versions to stay compatible with RN ${RN_VERSION} (avoid grabbing latest majors).
  npm install --no-audit --no-fund --legacy-peer-deps \
    "@react-navigation/native@6.1.18" \
    "@react-navigation/native-stack@6.10.1" \
    "@react-navigation/bottom-tabs@6.6.1" \
    "@react-native-async-storage/async-storage@1.23.1" \
    "react-native-gesture-handler@2.16.2" \
    "react-native-reanimated@3.10.1" \
    "react-native-safe-area-context@4.10.1" \
    "react-native-screens@3.31.1" \
    "react-native-svg@15.2.0" \
    "react-native-qrcode-svg@6.3.0" \
    "react-native-sqlite-storage@6.0.1" \
    "react-native-fs@2.20.0" \
    "react-native-document-picker@9.3.1" \
    "react-native-image-picker@7.1.2" \
    "react-native-webrtc@124.0.7" \
    "react-native-biometrics@3.0.1" \
    "js-sha256@0.11.0" \
    "buffer@6.0.3" \
	    "tweetnacl@1.0.3" \
	    "react-native-get-random-values@1.11.0"

  # Audio recorder/player: pin to pre-Nitro major to avoid missing :react-native-nitro-modules
  npm install --no-audit --no-fund --legacy-peer-deps "react-native-audio-recorder-player@${AUDIO_RECORDER_PLAYER_VER}"
}



maybe_enable_firebase_push(){
  # Optional: enable @react-native-firebase/messaging if firebase/google-services.json exists.
  local cfg_src="${ROOT_DIR}/firebase/google-services.json"
  if [[ ! -f "${cfg_src}" ]]; then
    log "Firebase config not found (${cfg_src}) -> push disabled (ok)"
    return 0
  fi

  log "Firebase config found -> enabling RNFirebase messaging"

  cd "${APP_DIR}"

  # Pin versions for RN 0.74.x
  npm install --no-audit --no-fund --legacy-peer-deps \
    "@react-native-firebase/app@18.8.0" \
    "@react-native-firebase/messaging@18.8.0"

  # Copy google-services.json
  mkdir -p android/app
  cp -f "${cfg_src}" android/app/google-services.json

  # Patch Gradle for google-services plugin (only if not present)
  python3 - <<'PY_FCM'
from pathlib import Path
import re

root_gradle = Path("android/build.gradle")
app_gradle = Path("android/app/build.gradle")

if root_gradle.exists():
    txt = root_gradle.read_text(encoding="utf-8")
    if "com.google.gms:google-services" not in txt:
        # Insert into buildscript dependencies { classpath ... }
        def repl(m):
            body = m.group(1)
            ins = "        classpath(\"com.google.gms:google-services:4.4.2\")\n"
            # Groovy style: classpath '...'
            ins2 = "        classpath 'com.google.gms:google-services:4.4.2'\n"
            # prefer groovy if file uses single quotes
            if "'" in body and "classpath '" in body:
                add = ins2
            else:
                add = ins
            return "dependencies {\n" + add + body
        txt2 = re.sub(r'dependencies\s*\{\n([\s\S]*?)', lambda m: repl(m), txt, count=1)
        if txt2 != txt:
            root_gradle.write_text(txt2, encoding="utf-8")

if app_gradle.exists():
    txt = app_gradle.read_text(encoding="utf-8")
    if "com.google.gms.google-services" not in txt:
        # Apply plugin at bottom (safe for RN templates)
        txt2 = txt.rstrip() + "\n\napply plugin: 'com.google.gms.google-services'\n"
        app_gradle.write_text(txt2, encoding="utf-8")
PY_FCM

  log "Firebase patch applied."
}


force_babel_config(){
  # Force a known-good Babel config that supports TypeScript and Reanimated.
  # Some earlier patching approaches produced configs that didn't enable TS parsing.
  cd "${APP_DIR}"
  cat > babel.config.js <<'EOF'
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
EOF
}


patch_gradle_java_home(){
  cd "${APP_DIR}"
  mkdir -p android
  local gp="android/gradle.properties"
  touch "${gp}"
  # Drop stale Java config from previous runs
  grep -vE '^(org\.gradle\.java\.installations\.paths|org\.gradle\.java\.installations\.auto-detect|org\.gradle\.java\.home|org\.gradle\.daemon|org\.gradle\.workers\.max|org\.gradle\.jvmargs|kotlin\.daemon\.jvmargs)=' "${gp}" > "${gp}.tmp" || true
  mv "${gp}.tmp" "${gp}"
  {
    echo "org.gradle.java.home=${JAVA_HOME}"
    echo "org.gradle.java.installations.auto-detect=false"
    echo "org.gradle.java.installations.paths=${JAVA_HOME}"
    # Keep Gradle/Metro within RAM limits on VPS; reduce workers and heap.
    echo "org.gradle.daemon=false"
    echo "org.gradle.workers.max=2"
    echo "org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8"
    echo "kotlin.daemon.jvmargs=-Xmx512m"
    echo "android.useAndroidX=true"
    echo "android.enableJetifier=true"
  } >> "${gp}"
}

patch_release_signing(){
  cd "${APP_DIR}"

  cat > android/keystore.properties <<EOF
storePassword=changeit
keyPassword=changeit
keyAlias=lexmess
storeFile=app/lexmess-release.keystore
EOF

  if [[ -f android/app/build.gradle ]]; then
    python3 - <<'PY'
import pathlib, re

p = pathlib.Path("android/app/build.gradle")
txt = p.read_text(encoding="utf-8")

# Insert keystore loader before android { ... } if missing
if "keystorePropertiesFile" not in txt:
    loader_lines = [
        "def keystorePropertiesFile = rootProject.file(\"keystore.properties\")",
        "def keystoreProperties = new Properties()",
        "if (keystorePropertiesFile.exists()) {",
        "    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))",
        "}",
        "",
        ""
    ]
    loader = "\n".join(loader_lines)
    m = re.search(r'(?m)^\s*android\s*\{', txt)
    if m:
        txt = txt[:m.start()] + loader + txt[m.start():]
    else:
        txt = loader + txt

def find_block(src: str, keyword_regex: str):
    m = re.search(keyword_regex, src, flags=re.M)
    if not m:
        return None
    i = src.find("{", m.end())
    if i == -1:
        return None
    depth = 0
    for j in range(i, len(src)):
        ch = src[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return (i, j)
    return None

android_block = find_block(txt, r'^\s*android\s*\{')
if not android_block:
    raise SystemExit("Cannot find android { } block in android/app/build.gradle")

a_start, a_end = android_block
android_src = txt[a_start:a_end+1]

release_lines = [
    "        release {",
    "            if (keystorePropertiesFile.exists()) {",
    "                storeFile file(keystoreProperties['storeFile'])",
    "                storePassword keystoreProperties['storePassword']",
    "                keyAlias keystoreProperties['keyAlias']",
    "                keyPassword keystoreProperties['keyPassword']",
    "            }",
    "        }",
]
release_snippet = "\n".join(release_lines)

sign_block = find_block(android_src, r'^\s*signingConfigs\s*\{')
if sign_block:
    s_start, s_end = sign_block
    sign_src = android_src[s_start:s_end+1]
    if re.search(r'(?m)^\s*release\s*\{', sign_src) is None:
        insert_pos = s_start + 1
        android_src = android_src[:insert_pos] + "\n" + release_snippet + android_src[insert_pos:]
else:
    insert_pos = 1
    new_block = "\n    signingConfigs {\n" + release_snippet + "\n    }\n"
    android_src = android_src[:insert_pos] + new_block + android_src[insert_pos:]

bt_block = find_block(android_src, r'^\s*buildTypes\s*\{')
if bt_block:
    bt_start, bt_end = bt_block
    bt_src = android_src[bt_start:bt_end+1]
    rel_block = find_block(bt_src, r'^\s*release\s*\{')
    if rel_block:
        r_start, r_end = rel_block
        rel_src = bt_src[r_start:r_end+1]
        if "signingConfig signingConfigs.release" not in rel_src:
            if "signingConfig signingConfigs.debug" in rel_src:
                rel_src2 = rel_src.replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.release")
            else:
                insert_at = rel_src.find("{") + 1
                rel_src2 = rel_src[:insert_at] + "\n            signingConfig signingConfigs.release\n" + rel_src[insert_at:]
            bt_src = bt_src[:r_start] + rel_src2 + bt_src[r_end+1:]
            android_src = android_src[:bt_start] + bt_src + android_src[bt_end+1:]

txt2 = txt[:a_start] + android_src + txt[a_end+1:]
p.write_text(txt2, encoding="utf-8")
PY
  else
    log "WARNING: android/app/build.gradle not found; cannot patch signing."
  fi
}

patch_android_project(){
  log "Patching Android project"
  cd "${APP_DIR}"

  local main_app
  main_app="$(grep -Rsl "class MainApplication" android/app/src/main/java | head -n 1 || true)"
  [[ -n "${main_app}" ]] || die "Could not find MainApplication under android/app/src/main/java"

  local is_kotlin=0
  [[ "${main_app}" == *.kt ]] && is_kotlin=1

  local app_pkg
  app_pkg="$(grep -m1 "^package " "${main_app}" | awk '{print $2}' | tr -d ';')"
  [[ -n "${app_pkg}" ]] || die "Could not parse package name from ${main_app}"

  local module_pkg="${app_pkg}.lexmesscore"
  local pkg_path
  pkg_path="$(echo "${module_pkg}" | tr '.' '/')"

  mkdir -p "android/app/src/main/java/${pkg_path}"

  sed -e "s/__MODULE_PACKAGE__/${module_pkg}/g" -e "s/__APP_PACKAGE__/${module_pkg}/g" "${ROOT_DIR}/tools/android/LexmessCoreModule.kt.tmpl" \
    > "android/app/src/main/java/${pkg_path}/LexmessCoreModule.kt"
  sed -e "s/__MODULE_PACKAGE__/${module_pkg}/g" -e "s/__APP_PACKAGE__/${module_pkg}/g" "${ROOT_DIR}/tools/android/LexmessCorePackage.kt.tmpl" \
    > "android/app/src/main/java/${pkg_path}/LexmessCorePackage.kt"

  # Patch MainApplication/MainActivity and app label (robust; no sed hacks)
  # Force-patch MainApplication/MainActivity and app label for FINAL_NAME
  export MAIN_APP_PATH="${main_app}"
  export MODULE_PKG="${module_pkg}"
  export FINAL_NAME="${FINAL_NAME}"
  python3 - <<'PY_FORCE'
import json
import os
import re
import shutil
from pathlib import Path

FINAL_NAME = os.environ.get("LEXMESS_FINAL_NAME", "LexMess")
TMP_NAME   = os.environ.get("LEXMESS_TMP_NAME", "LexMessTmp")

# If you want a custom package, set it via env; defaults keep current template package.
FINAL_PKG  = os.environ.get("LEXMESS_FINAL_PKG", "com.lexmess")
TMP_PKG    = os.environ.get("LEXMESS_TMP_PKG", "com.lexmesstmp")

MODULE_PKG = os.environ.get("MODULE_PKG") or f"{FINAL_PKG}.lexmesscore"

root = Path(".").resolve()
android_dir = root / "android"
app_dir = android_dir / "app"

def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")

def write_text(p: Path, s: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding="utf-8")

def patch_json(path: Path) -> None:
    if not path.exists():
        return
    try:
        obj = json.loads(read_text(path))
    except Exception:
        return
    changed = False
    if isinstance(obj, dict):
        if obj.get("name") != FINAL_NAME:
            obj["name"] = FINAL_NAME
            changed = True
        if obj.get("displayName") != FINAL_NAME:
            obj["displayName"] = FINAL_NAME
            changed = True
    if changed:
        write_text(path, json.dumps(obj, ensure_ascii=False, indent=2) + "\n")

def patch_settings_gradle(path: Path) -> None:
    if not path.exists():
        return
    s = read_text(path)
    s2 = re.sub(r"(?m)^\s*rootProject\.name\s*=\s*['\"].*?['\"]\s*$",
                f"rootProject.name = '{FINAL_NAME}'", s)
    if s2 != s:
        write_text(path, s2)

def patch_strings_xml(path: Path) -> None:
    if not path.exists():
        return
    s = read_text(path)
    s2 = re.sub(r'(<string\s+name="app_name">)(.*?)(</string>)',
                rf"\1{FINAL_NAME}\3", s, flags=re.S)
    if s2 != s:
        write_text(path, s2)

def patch_manifest_package(path: Path) -> None:
    if not path.exists():
        return
    s = read_text(path)
    s2 = re.sub(r'(<manifest\b[^>]*\bpackage=")([^"]+)(")',
                rf"\1{FINAL_PKG}\3", s)
    if s2 != s:
        write_text(path, s2)

def patch_app_build_gradle(path: Path) -> None:
    if not path.exists():
        return
    s = read_text(path)
    s2 = s
    s2 = re.sub(r"(?m)^\s*namespace\s+['\"][^'\"]+['\"]\s*$",
                f'  namespace "{FINAL_PKG}"', s2)
    s2 = re.sub(r"(?m)^\s*applicationId\s+['\"][^'\"]+['\"]\s*$",
                f'    applicationId "{FINAL_PKG}"', s2)
    if s2 != s:
        write_text(path, s2)

def replace_in_text_files(base: Path) -> None:
    if not base.exists():
        return
    for p in base.rglob('*'):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {'.kt', '.java', '.xml', '.gradle', '.kts', '.properties'}:
            continue
        try:
            s = read_text(p)
        except Exception:
            continue
        s2 = s.replace(TMP_PKG, FINAL_PKG)
        if s2 != s:
            write_text(p, s2)

def ensure_main_activity_and_app():
    src_main_java = app_dir / 'src' / 'main' / 'java'
    main_activity = None
    main_app = None
    if src_main_java.exists():
        for p in src_main_java.rglob('MainActivity.kt'):
            main_activity = p
            break
        if main_activity is None:
            for p in src_main_java.rglob('MainActivity.java'):
                main_activity = p
                break
        for p in src_main_java.rglob('MainApplication.kt'):
            main_app = p
            break
        if main_app is None:
            for p in src_main_java.rglob('MainApplication.java'):
                main_app = p
                break

    pkg_path = Path(*FINAL_PKG.split('.'))

    if main_activity and main_activity.suffix == '.kt':
        write_text(main_activity, f"""package {FINAL_PKG}

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {{
  override fun getMainComponentName(): String = \"{FINAL_NAME}\"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}}
""")
    elif main_activity and main_activity.suffix == '.java':
        write_text(main_activity, f"""package {FINAL_PKG};

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class MainActivity extends ReactActivity {{
  @Override
  protected String getMainComponentName() {{
    return \"{FINAL_NAME}\";
  }}

  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {{
    return new DefaultReactActivityDelegate(this, getMainComponentName(), DefaultNewArchitectureEntryPoint.getFabricEnabled());
  }}
}}
""")
    else:
        p = src_main_java / pkg_path / 'MainActivity.kt'
        write_text(p, f"""package {FINAL_PKG}

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {{
  override fun getMainComponentName(): String = \"{FINAL_NAME}\"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}}
""")

    if main_app and main_app.suffix == '.kt':
        write_text(main_app, f"""package {FINAL_PKG}

import android.app.Application
import com.facebook.react.PackageList
import {MODULE_PKG}.LexmessCorePackage
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {{

  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {{
      override fun getPackages(): List<ReactPackage> =
        PackageList(this).packages.apply {{
          // Packages that cannot be autolinked yet can be added manually here.
          // LexMess native module (core crypto/stego helpers).
          add(LexmessCorePackage())
        }}

      override fun getJSMainModuleName(): String = \"index\"

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }}

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {{
    super.onCreate()
    SoLoader.init(this, /* native exopackage */ false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {{
      load()
    }}
  }}
}}
""")
    elif main_app is None:
        p = src_main_java / pkg_path / 'MainApplication.kt'
        write_text(p, f"""package {FINAL_PKG}

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import {MODULE_PKG}.LexmessCorePackage
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {{

  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {{
      override fun getPackages(): List<ReactPackage> =
        PackageList(this).packages.apply {{
          // Packages that cannot be autolinked yet can be added manually here.
          // LexMess native module (core crypto/stego helpers).
          add(LexmessCorePackage())
        }}

      override fun getJSMainModuleName(): String = \"index\"

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }}

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {{
    super.onCreate()
    SoLoader.init(this, /* native exopackage */ false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {{
      load()
    }}
  }}
}}
""")

def ensure_android_name_refs() -> None:
    strings = app_dir / 'src' / 'main' / 'res' / 'values' / 'strings.xml'
    patch_strings_xml(strings)
    for m in app_dir.rglob('AndroidManifest.xml'):
        patch_manifest_package(m)

patch_json(root / 'app.json')

pkg_json = root / 'package.json'
if pkg_json.exists():
    try:
        obj = json.loads(read_text(pkg_json))
        if isinstance(obj, dict) and obj.get('name') == TMP_NAME.lower():
            obj['name'] = FINAL_NAME.lower()
            write_text(pkg_json, json.dumps(obj, ensure_ascii=False, indent=2) + "\n")
    except Exception:
        pass

patch_settings_gradle(android_dir / 'settings.gradle')
patch_settings_gradle(android_dir / 'settings.gradle.kts')

patch_app_build_gradle(app_dir / 'build.gradle')
patch_app_build_gradle(app_dir / 'build.gradle.kts')

replace_in_text_files(app_dir)
ensure_main_activity_and_app()
ensure_android_name_refs()

print('[patch] Applied: appName=%s package=%s' % (FINAL_NAME, FINAL_PKG))
PY_FORCE

  {
    echo "sdk.dir=${ANDROID_SDK_ROOT}";
    if [[ -n "${ANDROID_NDK_HOME:-}" && -d "${ANDROID_NDK_HOME}" ]]; then
      echo "ndk.dir=${ANDROID_NDK_HOME}";
    fi
  } > android/local.properties

  # Force Android SDK versions (min/target/compile/buildTools) in Gradle files.
  # RN templates often store these in android/build.gradle (rootProject.ext).
  python3 - <<'PY'
import os
import re
from pathlib import Path

MIN = int(os.environ.get("MIN_SDK", "24"))
TARGET = int(os.environ.get("TARGET_SDK", "34"))
BUILD_TOOLS = os.environ.get("ANDROID_BUILD_TOOLS", "")

def patch_file(path: Path):
    if not path.exists():
        return
    txt = path.read_text(encoding="utf-8")
    orig = txt

    # Ext assignments: minSdkVersion = 23
    txt = re.sub(r'(?m)^(\\s*minSdkVersion\\s*=\\s*)(\\d+)\\b', lambda m: f"{m.group(1)}{MIN}", txt)
    txt = re.sub(r'(?m)^(\\s*targetSdkVersion\\s*=\\s*)(\\d+)\\b', lambda m: f"{m.group(1)}{TARGET}", txt)
    txt = re.sub(r'(?m)^(\\s*compileSdkVersion\\s*=\\s*)(\\d+)\\b', lambda m: f"{m.group(1)}{TARGET}", txt)

    # Method-call style: minSdkVersion 23
    txt = re.sub(r'(?m)^(\\s*minSdkVersion\\s+)(\\d+)\\b', lambda m: f"{m.group(1)}{MIN}", txt)
    txt = re.sub(r'(?m)^(\\s*targetSdkVersion\\s+)(\\d+)\\b', lambda m: f"{m.group(1)}{TARGET}", txt)
    txt = re.sub(r'(?m)^(\\s*compileSdkVersion\\s+)(\\d+)\\b', lambda m: f"{m.group(1)}{TARGET}", txt)

    # Expression style: minSdkVersion rootProject.ext.minSdkVersion
    txt = re.sub(r'(?m)^(\s*minSdkVersion\s+)(rootProject\.ext\.minSdkVersion|project\.ext\.minSdkVersion)\b',
                 lambda m: f"{m.group(1)}{MIN}", txt)
    txt = re.sub(r'(?m)^(\s*targetSdkVersion\s+)(rootProject\.ext\.targetSdkVersion|project\.ext\.targetSdkVersion)\b',
                 lambda m: f"{m.group(1)}{TARGET}", txt)
    txt = re.sub(r'(?m)^(\s*compileSdkVersion\s+)(rootProject\.ext\.compileSdkVersion|rootProject\.ext\.targetSdkVersion|project\.ext\.compileSdkVersion|project\.ext\.targetSdkVersion)\b',
                 lambda m: f"{m.group(1)}{TARGET}", txt)

    # Kotlin DSL (build.gradle.kts) styles
    txt = re.sub(r'(?m)^(\s*minSdk\s*=\s*)(\d+)\b', lambda m: f"{m.group(1)}{MIN}", txt)
    txt = re.sub(r'(?m)^(\s*targetSdk\s*=\s*)(\d+)\b', lambda m: f"{m.group(1)}{TARGET}", txt)
    txt = re.sub(r'(?m)^(\s*compileSdk\s*=\s*)(\d+)\b', lambda m: f"{m.group(1)}{TARGET}", txt)

    if BUILD_TOOLS:
        txt = re.sub(r'(?m)^(\\s*buildToolsVersion\\s*=\\s*)"[0-9.]+"', lambda m: f'{m.group(1)}"{BUILD_TOOLS}"', txt)
        txt = re.sub(r'(?m)^(\\s*buildToolsVersion\\s*)"[0-9.]+"', lambda m: f'{m.group(1)}"{BUILD_TOOLS}"', txt)

    if txt != orig:
        path.write_text(txt, encoding="utf-8")

patch_file(Path("android/build.gradle"))
patch_file(Path("android/app/build.gradle"))

mp = Path("android/app/src/main/AndroidManifest.xml")
if mp.exists():
    mtxt = mp.read_text(encoding="utf-8")
    mtxt2 = re.sub(r'android:minSdkVersion="\\d+"', f'android:minSdkVersion="{MIN}"', mtxt)
    mtxt2 = re.sub(r'android:targetSdkVersion="\\d+"', f'android:targetSdkVersion="{TARGET}"', mtxt2)
    if mtxt2 != mtxt:
        mp.write_text(mtxt2, encoding="utf-8")
PY

  # R8: ensure Android permissions in AndroidManifest.xml (builder-level)
  python3 - <<'PY_PERMS'
from pathlib import Path
import re

mp = Path("android/app/src/main/AndroidManifest.xml")
if not mp.exists():
    raise SystemExit(0)

txt = mp.read_text(encoding="utf-8")

wanted = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
    '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
]

features = [
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
]

insert_lines = []
for line in wanted:
    if line not in txt:
        insert_lines.append(line)
for line in features:
    if line not in txt:
        insert_lines.append(line)

if not insert_lines:
    raise SystemExit(0)

block = "\n    " + "\n    ".join(insert_lines) + "\n"

# Insert right after <manifest ...> opening tag
m = re.search(r'(<manifest[^>]*>)', txt)
if not m:
    raise SystemExit(0)

pos = m.end(1)
txt2 = txt[:pos] + block + txt[pos:]
mp.write_text(txt2, encoding="utf-8")
PY_PERMS

  patch_release_signing
  patch_gradle_java_home

  log "Gradle SDK versions after patch:"
  (cd "${APP_DIR}/android" && grep -nE "minSdkVersion|targetSdkVersion|compileSdkVersion|buildToolsVersion|minSdk\s*=|targetSdk\s*=|compileSdk\s*=" build.gradle app/build.gradle 2>/dev/null || true)
}

ensure_release_keystore(){
  log "Ensuring release keystore"
  local ks="${APP_DIR}/android/app/lexmess-release.keystore"
  if [[ -f "${ks}" ]]; then
    log "Keystore already exists: ${ks}"
    return 0
  fi
  log "Generating self-signed keystore: ${ks}"
  keytool -genkeypair \
    -v \
    -storetype JKS \
    -keystore "${ks}" \
    -storepass "changeit" \
    -keypass "changeit" \
    -alias "lexmess" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 3650 \
    -dname "CN=LexMess, OU=Dev, O=LexMess, L=Berlin, ST=Berlin, C=DE"
}

build_android_release(){
  log "Building Android release (APK + AAB)"
  cd "${APP_DIR}/android"
  # Limit Node memory during Metro bundling (prevents OOM kills)
  export NODE_OPTIONS="--max-old-space-size=1024"
  export GRADLE_OPTS="${GRADLE_OPTS:-} -Dorg.gradle.daemon=false"
  ./gradlew --no-daemon --max-workers=2 clean assembleRelease bundleRelease

  mkdir -p "${ROOT_DIR}/dist"
  cp -f app/build/outputs/apk/release/*.apk "${ROOT_DIR}/dist/LexMess-release.apk" || true
  cp -f app/build/outputs/bundle/release/*.aab "${ROOT_DIR}/dist/LexMess-release.aab" || true

  log "Done."
  log "APK: ${ROOT_DIR}/dist/LexMess-release.apk"
  log "AAB: ${ROOT_DIR}/dist/LexMess-release.aab"
}

main(){
  log "ROOT_DIR=${ROOT_DIR}"
  log "APP_DIR=${APP_DIR}"
  log "RN_VERSION=${RN_VERSION}"
  log "ANDROID_PLATFORM=${ANDROID_PLATFORM} MIN_SDK=${MIN_SDK} TARGET_SDK=${TARGET_SDK}"

  maybe_install_apt zip rsync python3 cmake ninja-build make g++
  setup_java
  ensure_java_common_path
  setup_node
  detect_android_sdk
  ensure_android_components
  ensure_swap

  init_or_reuse_rn_project
  overlay_sources
  install_js_deps
  maybe_enable_firebase_push
  force_babel_config
  patch_android_project
  ensure_release_keystore
  build_android_release
}

main "$@"
