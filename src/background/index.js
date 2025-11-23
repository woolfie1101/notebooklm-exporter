console.log('NotebookLM Exporter Background Service Worker Loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'DOWNLOAD') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: true // Let user choose where to save, or set to false to save automatically
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, downloadId });
            }
        });
        return true; // Keep channel open
    }
});
