document.addEventListener('DOMContentLoaded', () => {
    const btnPdf = document.getElementById('btn-pdf');
    const btnTxt = document.getElementById('btn-txt');
    const btnMd = document.getElementById('btn-md');
    const statusMsg = document.getElementById('status-msg');

    function setStatus(msg, type = 'info') {
        statusMsg.textContent = msg;
        statusMsg.style.color = type === 'error' ? '#d93025' : '#5f6368';
    }

    async function sendMessageToContentScript(action) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                setStatus('No active tab found', 'error');
                return;
            }

            // Check if we are on notebooklm.google.com
            if (!tab.url.includes('notebooklm.google.com')) {
                setStatus('Please use on NotebookLM', 'error');
                return;
            }

            setStatus('Exporting...', 'info');

            const response = await chrome.tabs.sendMessage(tab.id, { action });

            if (response && response.success) {
                setStatus('Export successful!', 'info');
                setTimeout(() => setStatus('Ready to export'), 3000);
            } else {
                setStatus('Export failed: ' + (response?.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error(error);
            setStatus('Error: Could not connect to page. Refresh?', 'error');
        }
    }

    btnPdf.addEventListener('click', () => sendMessageToContentScript('EXPORT_PDF'));
    btnTxt.addEventListener('click', () => sendMessageToContentScript('EXPORT_TXT'));
    btnMd.addEventListener('click', () => sendMessageToContentScript('EXPORT_MD'));
});
