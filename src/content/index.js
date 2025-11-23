import { jsPDF } from 'jspdf';
import TurndownService from 'turndown';
import html2canvas from 'html2canvas';

console.log('NotebookLM Exporter Content Script Loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    handleExport(request.action)
        .then(() => sendResponse({ success: true }))
        .catch((err) => {
            console.error('Export error:', err);
            sendResponse({ success: false, error: err.message });
        });
    return true; // Keep channel open for async response
});

async function handleExport(action) {
    const content = getContent();
    if (!content) {
        throw new Error('No content found. Please select text or ensure content is visible.');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `notebooklm-export-${timestamp}`;

    switch (action) {
        case 'EXPORT_PDF':
            await exportPdf(content, filename);
            break;
        case 'EXPORT_TXT':
            exportTxt(content, filename);
            break;
        case 'EXPORT_MD':
            exportMd(content, filename);
            break;
        default:
            throw new Error('Unknown action');
    }
}

function getContent() {
    // 1. Try selected text
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
        const container = document.createElement('div');
        for (let i = 0; i < selection.rangeCount; i++) {
            container.appendChild(selection.getRangeAt(i).cloneContents());
        }
        return cleanContent(container);
    }

    // 2. Try to find main content container
    // NotebookLM specific classes might change, so we use heuristics.
    const selectors = [
        'labs-tailwind-doc-viewer', // Specific to NotebookLM
        '.artifact-content',        // Extracted from user screenshot
        'main',
        'article',
        '[role="main"]',
        '.notebook-content',
        '#content'
    ];

    for (const selector of selectors) {
        // Try finding all matching elements and pick the one with the most text
        const elements = document.querySelectorAll(selector);
        let bestMatch = null;
        let maxLen = 0;

        elements.forEach(el => {
            const len = el.innerText.trim().length;
            if (len > maxLen) {
                maxLen = len;
                bestMatch = el;
            }
        });

        if (bestMatch && maxLen > 50) {
            return cleanContent(bestMatch);
        }
    }

    // 3. Fallback: Find the element with the most text
    // This is expensive but useful as a last resort
    let bestElement = null;
    let maxTextLength = 0;

    const allDivs = document.querySelectorAll('div, section');
    for (const div of allDivs) {
        // Skip hidden elements or small snippets
        if (div.offsetParent === null) continue;

        const length = div.innerText.trim().length;
        if (length > maxTextLength) {
            maxTextLength = length;
            bestElement = div;
        }
    }

    if (bestElement && maxTextLength > 50) {
        return cleanContent(bestElement);
    }

    return null;
}

function cleanContent(element) {
    // Clone the element to avoid modifying the actual page
    const clone = element.cloneNode(true);

    // Remove citation numbers
    // Heuristic: NotebookLM citations are often buttons or spans with numbers
    // We'll look for elements that look like citations.
    // Based on common patterns: buttons with numbers, or specific classes if we knew them.
    // Since we don't know the exact class, we'll try to target small elements containing only numbers.

    const potentialCitations = clone.querySelectorAll('button, span, a');
    potentialCitations.forEach(el => {
        const text = el.innerText.trim();
        // Check if text is a number (e.g., "1", "57") or a range (e.g., "1-3" though rare in citations)
        // And check if it's small (citations are usually short)
        if (/^\d+$/.test(text) && text.length < 4) {
            // It's likely a citation number.
            // Also check if it has a tooltip or specific aria-label usually associated with citations if possible.
            // For now, removing standalone small numbers in buttons/spans is a safe bet for "cleaning".
            // But be careful not to remove valid numbers in text.
            // NotebookLM citations are usually distinct buttons.
            if (el.tagName === 'BUTTON') {
                el.remove();
            } else if (el.tagName === 'SPAN' && (el.className.includes('citation') || el.className.includes('source'))) {
                el.remove();
            } else {
                // If we are unsure, we might check if it's styled like a badge (border-radius, background).
                // Let's try a more aggressive approach for "buttons with numbers" which is the most common UI for citations.
            }
        }

        // Also remove the "..." button often found next to citations
        if (text === '...' || text === '…') {
            el.remove();
        }
    });

    // Specific selector for NotebookLM citations if we can guess/inspect (often look like bubbles)
    // Let's try removing all <button> tags that contain only numbers.
    const buttons = clone.querySelectorAll('button');
    buttons.forEach(btn => {
        if (/^\d+$/.test(btn.innerText.trim())) {
            btn.remove();
        }
    });

    return {
        text: clone.innerText,
        html: clone.innerHTML
    };
}

async function exportPdf(content, filename) {
    // Create a temporary container to render the HTML content
    const container = document.createElement('div');
    container.innerHTML = content.html;

    // Apply styling to mimic a document and ensure visibility for html2canvas
    Object.assign(container.style, {
        width: '210mm', // A4 width
        padding: '20mm',
        position: 'fixed',
        left: '-9999px',
        top: '0',
        fontSize: '12pt',
        fontFamily: 'sans-serif',
        lineHeight: '1.6',
        color: '#000',
        background: '#fff',
        zIndex: '-1'
    });

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 2, // Higher scale for better quality
            useCORS: true,
            logging: false,
            windowWidth: container.scrollWidth,
            windowHeight: container.scrollHeight,
            backgroundColor: '#ffffff'
        });

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfPageWidth = pdf.internal.pageSize.getWidth();   // 210 mm
        const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
        const margin = 10; // 10mm
        const pdfContentWidth = pdfPageWidth - (margin * 2);
        const pdfContentHeight = pdfPageHeight - (margin * 2);

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        // Calculate the height of one PDF page in canvas pixels
        const pageHeightInPixels = (imgWidth * pdfContentHeight) / pdfContentWidth;

        let currentY = 0; // Current Y position on the source canvas (pixels)

        while (currentY < imgHeight) {
            if (currentY > 0) {
                pdf.addPage();
            }

            // Determine the height of the slice for this page
            let sliceHeight = pageHeightInPixels;

            // If this is the last page, just take the rest
            if (currentY + sliceHeight >= imgHeight) {
                sliceHeight = imgHeight - currentY;
            } else {
                // Check for cut-off text
                // Scan upwards from the bottom of the slice to find a whitespace
                // Search up to 20% of page height
                const splitY = findSplitPoint(ctx, imgWidth, currentY + sliceHeight, pageHeightInPixels * 0.2);
                sliceHeight = splitY - currentY;
            }

            // Create a temporary canvas for the slice
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = imgWidth;
            pageCanvas.height = sliceHeight;
            const pageCtx = pageCanvas.getContext('2d');

            // Draw the slice from the original canvas
            pageCtx.drawImage(canvas, 0, currentY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);

            const pageImgData = pageCanvas.toDataURL('image/png');

            // Calculate the height in PDF units
            const pdfSliceHeight = (sliceHeight * pdfContentWidth) / imgWidth;

            pdf.addImage(pageImgData, 'PNG', margin, margin, pdfContentWidth, pdfSliceHeight);

            currentY += sliceHeight;
        }

        pdf.save(`${filename}.pdf`);

    } catch (err) {
        console.error('HTML2Canvas error:', err);
        throw new Error('Failed to generate PDF image');
    } finally {
        document.body.removeChild(container);
    }
}

function findSplitPoint(ctx, width, targetY, maxSearch) {
    // Ensure we don't go beyond image bounds
    const maxY = ctx.canvas.height;
    if (targetY >= maxY) return maxY;

    const searchStart = Math.floor(targetY);
    const searchEnd = Math.floor(targetY - maxSearch);

    if (searchEnd < 0) return targetY; // Should not happen normally

    // Get pixel data for the search area
    const imageData = ctx.getImageData(0, searchEnd, width, searchStart - searchEnd);
    const data = imageData.data;
    const rows = searchStart - searchEnd;

    // Scan from bottom (targetY) up
    for (let r = rows - 1; r >= 0; r--) {
        let isWhiteRow = true;
        const rowOffset = r * width * 4;

        // Check pixels in the row
        // Optimization: check every 10th pixel to speed up
        for (let c = 0; c < width; c += 10) {
            const i = rowOffset + (c * 4);
            const red = data[i];
            const green = data[i + 1];
            const blue = data[i + 2];

            // Check if not white (allow some tolerance)
            if (red < 250 || green < 250 || blue < 250) {
                isWhiteRow = false;
                break;
            }
        }

        if (isWhiteRow) {
            return searchEnd + r;
        }
    }

    // If no split point found, return original target
    return targetY;
}

function exportTxt(content, filename) {
    const blob = new Blob([content.text], { type: 'text/plain' });
    downloadBlob(blob, `${filename}.txt`);
}

function exportMd(content, filename) {
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(content.html);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    downloadBlob(blob, `${filename}.md`);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
