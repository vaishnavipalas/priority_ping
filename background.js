chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isCanvas = tab.url.includes('canvas.cmu.edu') || tab.url.includes('instructure.com');
    if (isCanvas) {
      injectScripts(tabId);
    }
  }
});

async function injectScripts(tabId) {
  try {
    // Inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['styles.css']
    });

    // Inject Scripts in sequence
    const scripts = ['classifier.js', 'ui.js', 'content.js'];
    for (const script of scripts) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [script]
      });
    }
    console.log('PriorityPing scripts injected successfully into tab', tabId);
  } catch (err) {
    console.error('Failed to inject PriorityPing scripts:', err);
  }
}
