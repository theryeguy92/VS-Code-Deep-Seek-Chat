"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ollama_1 = __importDefault(require("ollama"));
function activate(context) {
    console.log('Congratulations, your extension "vs-deepseek-ext" is now active!');
    const disposable = vscode.commands.registerCommand('vs-deepseek-ext.helloWorld', () => {
        const panel = vscode.window.createWebviewPanel('deepChat', 'Deep Seek Chat', vscode.ViewColumn.One, { enableScripts: true });
        panel.webview.html = getWebviewContent();
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'chat') {
                const userPrompt = message.text;
                let responseText = '';
                try {
                    const streamResponse = await ollama_1.default.chat({
                        model: 'deepseek-r1:latest',
                        messages: [{ role: 'user', content: userPrompt }],
                        stream: true,
                    });
                    for await (const part of streamResponse) {
                        responseText += part.message.content;
                    }
                    // Process the AI response and send to the webview
                    const processedResponse = processResponse(responseText);
                    panel.webview.postMessage({ command: 'chatResponse', text: processedResponse });
                }
                catch (error) {
                    panel.webview.postMessage({ command: 'chatResponse', text: `Error: ${String(error)}` });
                }
            }
        });
    });
    context.subscriptions.push(disposable);
}
/**
 * Function to process AI responses and detect code blocks.
 */
function processResponse(response) {
    // Wrap <think> tags with custom styling
    response = response.replace(/<think>/g, '<span class="think-tag">&lt;think&gt;</span>');
    response = response.replace(/<\/think>/g, '<span class="think-tag">&lt;/think&gt;</span>');
    // Handle code blocks with a header and copy button
    response = response.replace(/```(\w+)?([\s\S]*?)```/g, (match, language, code) => {
        const lang = language || 'plaintext'; // Default to plaintext if no language is specified
        return `
            <div class="code-block">
                <div class="code-header">
                    <span>${lang}</span>
                    <button class="copy-btn" onclick="copyCode(this)">Copy</button>
                </div>
                <pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>
            </div>
        `;
    });
    return response;
}
/**
 * Escape HTML entities to prevent rendering issues.
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Webview content with minimal JavaScript.
 */
function getWebviewContent() {
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <style>
            body { font-family: sans-serif; margin: 1rem; background-color: #1e1e1e; color: #c7c7c7; }
            .chat-container { display: flex; flex-direction: column; height: 80vh; border: 1px solid #333; padding: 1rem; overflow-y: auto; background-color: #252526; }
            .user-message, .ai-message { margin: 0.5rem 0; padding: 0.5rem; border-radius: 8px; max-width: 80%; word-wrap: break-word; }
            .user-message { align-self: flex-end; background-color: #007bff; color: white; }
            .ai-message { align-self: flex-start; background-color: #f1f1f1; color: #333; }
            .think-tag { font-style: italic; color: #888; } /* Style for <think> tags */
            .code-block { border: 1px solid #333; border-radius: 8px; overflow: hidden; margin-top: 10px; }
            .code-header { display: flex; justify-content: space-between; align-items: center; background-color: #333; color: #fff; padding: 5px 10px; font-size: 0.9rem; }
            .copy-btn { background-color: #007bff; color: #fff; border: none; border-radius: 4px; padding: 3px 8px; cursor: pointer; }
            .copy-btn:hover { background-color: #0056b3; }
            pre { background-color: #1e1e1e; color: #d4d4d4; padding: 1rem; margin: 0; overflow-x: auto; font-family: "Courier New", Courier, monospace; }
            code { font-family: "Courier New", Courier, monospace; }
        </style>
    </head>
    <body>
        <h2>Deep VS Code Extension</h2>
        <div class="chat-container" id="chatContainer"></div>
        <div class="input-container">
            <textarea id="prompt" rows="2" placeholder="Ask me anything about your project!"></textarea>
            <button id="askBtn">Ask</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chatContainer');

            document.getElementById('askBtn').addEventListener('click', () => {
                const text = document.getElementById('prompt').value;
                if (!text.trim()) return;

                addMessage(text, 'user-message');
                vscode.postMessage({ command: 'chat', text });
                document.getElementById('prompt').value = '';
            });

            window.addEventListener('message', event => {
                const { command, text } = event.data;
                if (command === 'chatResponse') {
                    addMessage(text, 'ai-message', true);
                }
            });

            function addMessage(text, className, isHtml = false) {
                const messageDiv = document.createElement('div');
                messageDiv.className = className;
                if (isHtml) {
                    messageDiv.innerHTML = text; // Render as HTML for code blocks
                } else {
                    messageDiv.textContent = text; // Render as plain text
                }
                chatContainer.appendChild(messageDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll
            }

            // Copy the code block content to clipboard
            function copyCode(button) {
                const code = button.parentElement.nextElementSibling.innerText;
                navigator.clipboard.writeText(code).then(() => {
                    button.textContent = "Copied!";
                    setTimeout(() => (button.textContent = "Copy"), 2000);
                });
            }
        </script>
    </body>
    </html>
    `;
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map