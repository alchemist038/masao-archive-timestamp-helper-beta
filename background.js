chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "ytth-open-options") return;
  chrome.runtime.openOptionsPage();
});
