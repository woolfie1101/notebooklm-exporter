# NotebookLM Exporter Chrome Extension

This Chrome extension allows you to export content from Google NotebookLM to PDF, TXT, and Markdown formats.

## Features

- **Export to PDF**: Save your notes and results as a PDF document.
- **Export to TXT**: Download plain text content.
- **Export to Markdown**: Get a Markdown version of your notes, preserving basic formatting.

## Installation

1.  **Build the extension**:
    Ensure you have Node.js installed. Run the following commands in the terminal:
    ```bash
    npm install
    npm run build
    ```
    This will create a `dist` folder containing the extension.

2.  **Load into Chrome**:
    - Open Chrome and go to `chrome://extensions/`.
    - Enable **Developer mode** in the top right corner.
    - Click **Load unpacked**.
    - Select the `dist` folder inside the `notebooklm-exporter` directory.

## Usage

1.  Open [NotebookLM](https://notebooklm.google.com/).
2.  Select the text or content you want to export.
    - *Tip*: If you don't select anything, the extension will try to automatically detect the main content area.
3.  Click the extension icon in the Chrome toolbar.
4.  Choose your desired format: **PDF**, **TXT**, or **Markdown**.
5.  The file will be downloaded automatically.

## Troubleshooting

- **"No content found"**: Try selecting the text you want to export manually with your mouse, then click the export button again.
