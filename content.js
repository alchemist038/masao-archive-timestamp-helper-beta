(() => {
  const PANEL_ID = "ytth-panel";
  const SETTINGS_KEY = "ytthSettingsV1";
  const ENTRIES_PREFIX = "ytthEntriesV1:";
  const ALLOWED_CHANNEL_IDS = new Set(["UCmA7uYeOs8yV6dEjGmzutWA"]);
  const PAGE_INFO_WAIT_MS = 1500;
  const PAGE_INFO_POLL_MS = 250;
  const TIME_ADJUST_STEP_SECONDS = 1;
  const TIME_ADJUST_SHIFT_STEP_SECONDS = 5;

  const DEFAULT_SETTINGS = {
    offsetSeconds: 3,
    shortcutModifier: "alt",
    outputTemplate: "{time} {label}",
    presets: [
      { id: "goron", label: "ゴロン", key: "G" },
      { id: "akubi", label: "あくび", key: "A" },
      { id: "chimoshi", label: "ちもしー", key: "C" }
    ]
  };

  let settings = clone(DEFAULT_SETTINGS);
  let entries = [];
  let pageInfo = null;
  let panel = null;
  let lastUrl = location.href;
  let saveTimer = null;
  let toastTimer = null;
  let syncRunId = 0;
  const videoMetadataCache = new Map();

  init();

  async function init() {
    settings = await loadSettings();
    document.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("yt-navigate-finish", syncPage, true);
    window.setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        syncPage();
      }
    }, 800);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync" && changes[SETTINGS_KEY]) {
        settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
        if (panel) render();
      }
    });

    await syncPage();
  }

  async function syncPage() {
    const runId = ++syncRunId;
    const videoId = getVideoIdFromUrl();
    if (!videoId) {
      resetPageState();
      return;
    }

    if (pageInfo && pageInfo.videoId !== videoId) {
      resetPageState();
    }

    const nextInfo = await getPageInfo(videoId);
    if (runId !== syncRunId) return;

    if (!nextInfo) {
      resetPageState();
      return;
    }

    const pageChanged = !pageInfo || pageInfo.storageKey !== nextInfo.storageKey;
    pageInfo = nextInfo;

    if (pageChanged) {
      entries = await loadEntries(pageInfo.storageKey);
    }

    if (!panel) {
      createPanel();
    }

    render();
  }

  function resetPageState() {
    destroyPanel();
    pageInfo = null;
    entries = [];
  }

  function createPanel() {
    destroyPanel();
    panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "YouTube timestamp helper");
    panel.innerHTML = `
      <div class="ytth-header">
        <div class="ytth-title">
          <strong>Timestamp Helper</strong>
          <span class="ytth-subtitle"></span>
        </div>
        <button class="ytth-icon-button" type="button" data-action="collapse" title="最小化">-</button>
      </div>
      <div class="ytth-body">
        <div class="ytth-toolbar">
          <button class="ytth-button" type="button" data-action="stamp-empty" title="タイムスタンプだけ追加">+ 時刻</button>
          <button class="ytth-button" type="button" data-action="undo" title="直前の追加を取り消し">戻す</button>
          <button class="ytth-button" type="button" data-action="copy" data-tone="copy" title="コメント用テキストをコピー">コピー</button>
        </div>
        <div class="ytth-presets" aria-label="定型文"></div>
        <div class="ytth-list" aria-label="タイムスタンプ一覧"></div>
        <div class="ytth-footer">
          <span class="ytth-count"></span>
          <div class="ytth-footer-actions">
            <button class="ytth-link-button" type="button" data-action="clear">消去</button>
            <button class="ytth-link-button" type="button" data-action="options">設定</button>
          </div>
        </div>
      </div>
      <div class="ytth-toast" role="status" aria-live="polite"></div>
    `;

    panel.addEventListener("click", handlePanelClick);
    panel.addEventListener("input", handlePanelInput);
    document.documentElement.appendChild(panel);
  }

  function destroyPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
    panel = null;
  }

  function render() {
    if (!panel) return;

    const modifier = getModifierLabel(settings.shortcutModifier);
    const offsetText = `-${settings.offsetSeconds}秒 / ${modifier}+キー`;
    panel.querySelector(".ytth-subtitle").textContent = offsetText;
    panel.querySelector(".ytth-count").textContent = `${entries.length}件`;

    renderPresets(panel.querySelector(".ytth-presets"));
    renderEntries(panel.querySelector(".ytth-list"));
  }

  function renderPresets(root) {
    root.replaceChildren();

    settings.presets.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ytth-preset";
      button.dataset.action = "preset";
      button.dataset.presetId = preset.id;
      button.title = `${preset.label}を追加`;

      const label = document.createElement("span");
      label.className = "ytth-preset-label";
      label.textContent = preset.label;

      const key = document.createElement("span");
      key.className = "ytth-preset-key";
      key.textContent = preset.key ? `${getModifierLabel(settings.shortcutModifier)}+${preset.key}` : "クリック";

      button.append(label, key);
      root.appendChild(button);
    });
  }

  function renderEntries(root) {
    root.replaceChildren();

    const sortedEntries = getSortedEntries();
    if (!sortedEntries.length) {
      const empty = document.createElement("div");
      empty.className = "ytth-empty";
      empty.textContent = "まだ記録はありません";
      root.appendChild(empty);
      return;
    }

    sortedEntries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "ytth-entry";

      const timeButton = document.createElement("button");
      timeButton.type = "button";
      timeButton.className = "ytth-time-button";
      timeButton.dataset.action = "seek";
      timeButton.dataset.entryId = entry.id;
      timeButton.title = "この位置へ移動";
      timeButton.textContent = formatTime(entry.seconds);

      const minusButton = document.createElement("button");
      minusButton.type = "button";
      minusButton.className = "ytth-adjust-button";
      minusButton.dataset.action = "adjust-time";
      minusButton.dataset.direction = "-1";
      minusButton.dataset.entryId = entry.id;
      minusButton.title = "1秒戻す / Shift+クリックで5秒戻す";
      minusButton.textContent = "-";

      const plusButton = document.createElement("button");
      plusButton.type = "button";
      plusButton.className = "ytth-adjust-button";
      plusButton.dataset.action = "adjust-time";
      plusButton.dataset.direction = "1";
      plusButton.dataset.entryId = entry.id;
      plusButton.title = "1秒進める / Shift+クリックで5秒進める";
      plusButton.textContent = "+";

      const input = document.createElement("input");
      input.className = "ytth-entry-label";
      input.dataset.entryId = entry.id;
      input.value = entry.label;
      input.placeholder = "メモ";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "ytth-delete-button";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.entryId = entry.id;
      deleteButton.title = "削除";
      deleteButton.textContent = "x";

      row.append(timeButton, minusButton, plusButton, input, deleteButton);
      root.appendChild(row);
    });
  }

  async function handlePanelClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || !panel?.contains(button)) return;

    const action = button.dataset.action;
    if (action === "collapse") {
      panel.classList.toggle("ytth-collapsed");
      button.textContent = panel.classList.contains("ytth-collapsed") ? "+" : "-";
      return;
    }

    if (action === "stamp-empty") {
      await addStamp("");
      return;
    }

    if (action === "preset") {
      const preset = settings.presets.find((item) => item.id === button.dataset.presetId);
      if (preset) await addStamp(preset.label);
      return;
    }

    if (action === "undo") {
      undoLastEntry();
      return;
    }

    if (action === "copy") {
      await copyEntries();
      return;
    }

    if (action === "seek") {
      seekToEntry(button.dataset.entryId);
      return;
    }

    if (action === "adjust-time") {
      const direction = Number(button.dataset.direction) || 0;
      const stepSeconds = event.shiftKey ? TIME_ADJUST_SHIFT_STEP_SECONDS : TIME_ADJUST_STEP_SECONDS;
      await adjustEntryTime(button.dataset.entryId, direction, stepSeconds);
      return;
    }

    if (action === "delete") {
      deleteEntry(button.dataset.entryId);
      return;
    }

    if (action === "clear") {
      clearEntries();
      return;
    }

    if (action === "options") {
      openOptions();
    }
  }

  function openOptions() {
    chrome.runtime.sendMessage({ type: "ytth-open-options" }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        showToast("拡張機能アイコンから設定を開いてください");
      }
    });
  }

  function handlePanelInput(event) {
    const input = event.target.closest(".ytth-entry-label");
    if (!input) return;

    const entry = entries.find((item) => item.id === input.dataset.entryId);
    if (!entry) return;

    entry.label = input.value;
    scheduleSaveEntries();
  }

  async function handleKeydown(event) {
    if (!panel || !pageInfo) return;
    if (event.defaultPrevented || event.isComposing || isTypingTarget(event.target)) return;
    if (!matchesModifier(event)) return;

    const key = normalizeKey(event.key);
    if (!key) return;

    const preset = settings.presets.find((item) => normalizeKey(item.key) === key);
    if (preset) {
      event.preventDefault();
      event.stopPropagation();
      await addStamp(preset.label);
      return;
    }

    if (key === "T") {
      event.preventDefault();
      event.stopPropagation();
      await addStamp("");
      return;
    }

    if (key === "Z") {
      event.preventDefault();
      event.stopPropagation();
      undoLastEntry();
    }
  }

  async function addStamp(label) {
    const video = getVideo();
    if (!video || Number.isNaN(video.currentTime)) {
      showToast("動画が見つかりません");
      return;
    }

    const seconds = Math.max(0, Math.floor(video.currentTime - settings.offsetSeconds));
    entries.push({
      id: createId(),
      seconds,
      label,
      createdAt: Date.now()
    });

    await saveEntries();
    render();
    showToast(`${formatTime(seconds)} ${label}`.trim());
  }

  function undoLastEntry() {
    if (!entries.length) {
      showToast("戻せる記録がありません");
      return;
    }

    entries.sort((a, b) => a.createdAt - b.createdAt);
    const removed = entries.pop();
    saveEntries();
    render();
    showToast(`${formatTime(removed.seconds)} を戻しました`);
  }

  function deleteEntry(entryId) {
    const before = entries.length;
    entries = entries.filter((entry) => entry.id !== entryId);
    if (entries.length === before) return;
    saveEntries();
    render();
    showToast("削除しました");
  }

  function clearEntries() {
    if (!entries.length) return;
    const ok = window.confirm("この動画のタイムスタンプをすべて消去しますか？");
    if (!ok) return;
    entries = [];
    saveEntries();
    render();
    showToast("消去しました");
  }

  function seekToEntry(entryId) {
    const entry = entries.find((item) => item.id === entryId);
    const video = getVideo();
    if (!entry || !video) return;
    video.currentTime = entry.seconds;
    showToast(`${formatTime(entry.seconds)} へ移動`);
  }

  async function adjustEntryTime(entryId, direction, stepSeconds) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry || !direction) return;

    const previousSeconds = entry.seconds;
    const nextSeconds = Math.max(0, previousSeconds + direction * stepSeconds);
    if (nextSeconds === previousSeconds) {
      showToast("これ以上戻せません");
      return;
    }

    entry.seconds = nextSeconds;
    await saveEntries();
    render();
    showToast(`${formatTime(previousSeconds)} -> ${formatTime(nextSeconds)}`);
  }

  async function copyEntries() {
    const lines = getSortedEntries().map((entry) => {
      const time = formatTime(entry.seconds);
      return settings.outputTemplate
        .replaceAll("{time}", time)
        .replaceAll("{label}", entry.label)
        .trim();
    }).filter(Boolean);

    if (!lines.length) {
      showToast("コピーする記録がありません");
      return;
    }

    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    showToast(`${lines.length}件コピーしました`);
  }

  function getSortedEntries() {
    return [...entries].sort((a, b) => {
      if (a.seconds !== b.seconds) return a.seconds - b.seconds;
      return a.createdAt - b.createdAt;
    });
  }

  async function getPageInfo(videoId) {
    const metadata = await loadVideoMetadata(videoId);
    if (!metadata) return null;
    if (!ALLOWED_CHANNEL_IDS.has(metadata.channelId)) return null;
    if (!metadata.isLiveArchive) return null;

    return {
      videoId,
      storageKey: `${ENTRIES_PREFIX}${videoId}`
    };
  }

  function getVideoIdFromUrl() {
    const url = new URL(location.href);
    let videoId = "";

    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") || "";
    } else if (url.pathname.startsWith("/live/")) {
      videoId = url.pathname.split("/").filter(Boolean)[1] || "";
    }

    return videoId;
  }

  async function loadVideoMetadata(videoId) {
    if (videoMetadataCache.has(videoId)) {
      return videoMetadataCache.get(videoId);
    }

    const pageMetadata = await waitForVideoMetadata(videoId);
    if (pageMetadata) {
      videoMetadataCache.set(videoId, pageMetadata);
      return pageMetadata;
    }

    const fetchedMetadata = await fetchVideoMetadata(videoId);
    videoMetadataCache.set(videoId, fetchedMetadata);
    return fetchedMetadata;
  }

  async function waitForVideoMetadata(videoId) {
    const deadline = Date.now() + PAGE_INFO_WAIT_MS;
    let lastMetadata = null;

    while (Date.now() <= deadline) {
      const metadata = readVideoMetadataFromPage(videoId);
      if (metadata?.channelId) {
        lastMetadata = metadata;
        if (metadata.hasLiveStatus) return metadata;
      }
      await delay(PAGE_INFO_POLL_MS);
    }

    return lastMetadata;
  }

  function readVideoMetadataFromPage(videoId) {
    const playerResponse = readYouTubeJsonGlobal("ytInitialPlayerResponse");
    return parseVideoMetadata(playerResponse, videoId);
  }

  async function fetchVideoMetadata(videoId) {
    try {
      const response = await fetch(`/watch?v=${encodeURIComponent(videoId)}&hl=ja`, {
        credentials: "same-origin"
      });
      if (!response.ok) return null;

      const html = await response.text();
      const playerResponse = readYouTubeJsonFromText(html, "ytInitialPlayerResponse");
      return parseVideoMetadata(playerResponse, videoId);
    } catch {
      return null;
    }
  }

  function parseVideoMetadata(playerResponse, videoId) {
    if (!playerResponse || typeof playerResponse !== "object") return null;

    const videoDetails = playerResponse.videoDetails || {};
    const responseVideoId = String(videoDetails.videoId || "");
    if (responseVideoId && responseVideoId !== videoId) return null;

    const microformat = playerResponse.microformat?.playerMicroformatRenderer || {};
    const liveDetails = microformat.liveBroadcastDetails || null;
    const channelId = String(videoDetails.channelId || microformat.externalChannelId || "");
    if (!channelId) return null;

    const hasLiveContentFlag = typeof videoDetails.isLiveContent === "boolean";
    const hasLiveStatus = hasLiveContentFlag || Boolean(liveDetails) || typeof videoDetails.isLive === "boolean";
    const isLiveNow = Boolean(videoDetails.isLive || liveDetails?.isLiveNow);
    const hasPlaybackLength = Number(videoDetails.lengthSeconds) > 0;
    const isLiveArchive = Boolean(
      !isLiveNow &&
      hasPlaybackLength &&
      (liveDetails?.endTimestamp || (hasLiveContentFlag && videoDetails.isLiveContent))
    );

    return {
      channelId,
      hasLiveStatus,
      isLiveArchive
    };
  }

  function readYouTubeJsonGlobal(name) {
    const directValue = window[name];
    if (directValue && typeof directValue === "object") return directValue;

    for (const script of document.scripts) {
      const parsed = readYouTubeJsonFromText(script.textContent || "", name);
      if (parsed) return parsed;
    }

    return null;
  }

  function readYouTubeJsonFromText(text, name) {
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const nameIndex = text.indexOf(name, searchFrom);
      if (nameIndex === -1) return null;

      const afterName = nameIndex + name.length;
      const assignmentMatch = text.slice(afterName, afterName + 20).match(/^\s*=\s*/);
      if (!assignmentMatch) {
        searchFrom = afterName;
        continue;
      }

      const startIndex = text.indexOf("{", afterName + assignmentMatch[0].length);
      if (startIndex === -1) return null;

      const jsonText = extractBalancedJson(text, startIndex);
      if (jsonText) {
        try {
          return JSON.parse(jsonText);
        } catch {
          searchFrom = startIndex + 1;
          continue;
        }
      }

      searchFrom = startIndex + 1;
    }

    return null;
  }

  function extractBalancedJson(text, startIndex) {
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (char === "\\") {
          escaping = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(startIndex, index + 1);
      }
    }

    return "";
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function getVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  async function loadSettings() {
    const data = await storageGet(chrome.storage.sync, SETTINGS_KEY);
    return normalizeSettings(data[SETTINGS_KEY]);
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const merged = {
      ...clone(DEFAULT_SETTINGS),
      ...source
    };

    merged.offsetSeconds = clampNumber(merged.offsetSeconds, 0, 30, DEFAULT_SETTINGS.offsetSeconds);
    merged.outputTemplate = typeof merged.outputTemplate === "string" && merged.outputTemplate.trim()
      ? merged.outputTemplate
      : DEFAULT_SETTINGS.outputTemplate;
    merged.shortcutModifier = ["alt", "ctrlAlt", "shiftAlt"].includes(merged.shortcutModifier)
      ? merged.shortcutModifier
      : DEFAULT_SETTINGS.shortcutModifier;

    const presets = Array.isArray(source.presets) && source.presets.length
      ? source.presets
      : DEFAULT_SETTINGS.presets;

    merged.presets = presets
      .map((preset) => ({
        id: String(preset.id || createId()),
        label: String(preset.label || "").trim(),
        key: normalizeKey(preset.key)
      }))
      .filter((preset) => preset.label);

    if (!merged.presets.length) {
      merged.presets = clone(DEFAULT_SETTINGS.presets);
    }

    return merged;
  }

  async function loadEntries(storageKey) {
    const data = await storageGet(chrome.storage.local, storageKey);
    return normalizeEntries(data[storageKey]);
  }

  function normalizeEntries(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => ({
        id: String(entry.id || createId()),
        seconds: Math.max(0, Math.floor(Number(entry.seconds) || 0)),
        label: String(entry.label || ""),
        createdAt: Number(entry.createdAt) || Date.now()
      }))
      .filter((entry) => Number.isFinite(entry.seconds));
  }

  async function saveEntries() {
    if (!pageInfo) return;
    await storageSet(chrome.storage.local, { [pageInfo.storageKey]: entries });
  }

  function scheduleSaveEntries() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveEntries, 250);
  }

  function storageGet(area, key) {
    return new Promise((resolve, reject) => {
      area.get(key, (value) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(value);
      });
    });
  }

  function storageSet(area, value) {
    return new Promise((resolve, reject) => {
      area.set(value, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
    return `${m}:${pad2(s)}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function matchesModifier(event) {
    if (event.metaKey) return false;
    if (settings.shortcutModifier === "ctrlAlt") {
      return event.ctrlKey && event.altKey && !event.shiftKey;
    }
    if (settings.shortcutModifier === "shiftAlt") {
      return event.shiftKey && event.altKey && !event.ctrlKey;
    }
    return event.altKey && !event.ctrlKey && !event.shiftKey;
  }

  function getModifierLabel(modifier) {
    if (modifier === "ctrlAlt") return "Ctrl+Alt";
    if (modifier === "shiftAlt") return "Shift+Alt";
    return "Alt";
  }

  function normalizeKey(key) {
    if (!key) return "";
    const normalized = String(key).trim();
    if (!normalized) return "";
    if (normalized.length === 1) return normalized.toUpperCase();
    return normalized.toUpperCase();
  }

  function isTypingTarget(target) {
    if (!target || target === document.body) return false;
    const element = target instanceof Element ? target : target.parentElement;
    if (!element) return false;
    return Boolean(element.closest("input, textarea, select, [contenteditable='true'], ytd-commentbox"));
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(number)));
  }

  function createId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function showToast(message) {
    if (!panel) return;
    const toast = panel.querySelector(".ytth-toast");
    toast.textContent = message;
    toast.classList.add("ytth-toast-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("ytth-toast-visible");
    }, 1300);
  }
})();
