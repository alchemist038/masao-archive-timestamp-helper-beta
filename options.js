(() => {
  const SETTINGS_KEY = "ytthSettingsV1";
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

  const offsetSeconds = document.getElementById("offsetSeconds");
  const shortcutModifier = document.getElementById("shortcutModifier");
  const outputTemplate = document.getElementById("outputTemplate");
  const presetRows = document.getElementById("presetRows");
  const addPreset = document.getElementById("addPreset");
  const saveSettings = document.getElementById("saveSettings");
  const resetDefaults = document.getElementById("resetDefaults");
  const status = document.getElementById("status");

  let settings = clone(DEFAULT_SETTINGS);
  let statusTimer = null;

  init();

  async function init() {
    const data = await storageGet(SETTINGS_KEY);
    settings = normalizeSettings(data[SETTINGS_KEY]);
    renderSettings();

    addPreset.addEventListener("click", () => {
      settings.presets.push({ id: createId(), label: "新しい定型文", key: "" });
      renderPresets();
    });

    saveSettings.addEventListener("click", async () => {
      settings = collectSettings();
      await storageSet({ [SETTINGS_KEY]: settings });
      renderSettings();
      showStatus("保存しました");
    });

    resetDefaults.addEventListener("click", () => {
      settings = clone(DEFAULT_SETTINGS);
      renderSettings();
      showStatus("初期値");
    });
  }

  function renderSettings() {
    offsetSeconds.value = settings.offsetSeconds;
    shortcutModifier.value = settings.shortcutModifier;
    outputTemplate.value = settings.outputTemplate;
    renderPresets();
  }

  function renderPresets() {
    presetRows.replaceChildren();

    settings.presets.forEach((preset, index) => {
      const row = document.createElement("div");
      row.className = "preset-row";

      const labelField = createField("表示名");
      const labelInput = document.createElement("input");
      labelInput.value = preset.label;
      labelInput.dataset.index = String(index);
      labelInput.dataset.field = "label";
      labelInput.addEventListener("input", updatePresetFromInput);
      labelField.appendChild(labelInput);

      const keyField = createField("キー");
      const keyInput = document.createElement("input");
      keyInput.value = preset.key;
      keyInput.maxLength = 1;
      keyInput.dataset.index = String(index);
      keyInput.dataset.field = "key";
      keyInput.addEventListener("input", updatePresetFromInput);
      keyField.appendChild(keyInput);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-preset";
      remove.textContent = "削除";
      remove.addEventListener("click", () => {
        settings.presets.splice(index, 1);
        renderPresets();
      });

      row.append(labelField, keyField, remove);
      presetRows.appendChild(row);
    });
  }

  function createField(label) {
    const field = document.createElement("label");
    field.className = "field";

    const text = document.createElement("span");
    text.className = "preset-label";
    text.textContent = label;

    field.appendChild(text);
    return field;
  }

  function updatePresetFromInput(event) {
    const index = Number(event.target.dataset.index);
    const field = event.target.dataset.field;
    if (!settings.presets[index]) return;

    const value = field === "key"
      ? normalizeKey(event.target.value)
      : event.target.value;

    settings.presets[index][field] = value;
    if (field === "key") event.target.value = value;
  }

  function collectSettings() {
    const collected = {
      offsetSeconds: clampNumber(offsetSeconds.value, 0, 30, DEFAULT_SETTINGS.offsetSeconds),
      shortcutModifier: shortcutModifier.value,
      outputTemplate: outputTemplate.value.trim() || DEFAULT_SETTINGS.outputTemplate,
      presets: settings.presets
        .map((preset) => ({
          id: preset.id || createId(),
          label: String(preset.label || "").trim(),
          key: normalizeKey(preset.key)
        }))
        .filter((preset) => preset.label)
    };

    return normalizeSettings(collected);
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const merged = {
      ...clone(DEFAULT_SETTINGS),
      ...source
    };

    merged.offsetSeconds = clampNumber(merged.offsetSeconds, 0, 30, DEFAULT_SETTINGS.offsetSeconds);
    merged.shortcutModifier = ["alt", "ctrlAlt", "shiftAlt"].includes(merged.shortcutModifier)
      ? merged.shortcutModifier
      : DEFAULT_SETTINGS.shortcutModifier;
    merged.outputTemplate = typeof merged.outputTemplate === "string" && merged.outputTemplate.trim()
      ? merged.outputTemplate
      : DEFAULT_SETTINGS.outputTemplate;

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

    if (!merged.presets.length) merged.presets = clone(DEFAULT_SETTINGS.presets);
    return merged;
  }

  function storageGet(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(key, (value) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(value);
      });
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(value, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(number)));
  }

  function normalizeKey(key) {
    if (!key) return "";
    return String(key).slice(0, 1).toUpperCase();
  }

  function createId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function showStatus(message) {
    status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = "";
    }, 1600);
  }
})();
