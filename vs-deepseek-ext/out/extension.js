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
        // Serve the chat UI in the Webview
        panel.webview.html = getWebviewContent();
        // Listen for messages from the Webview
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'chat') {
                const userPrompt = message.text;
                let streamedResponse = '';
                try {
                    // Stream content from the Ollama LLM
                    const streamResponse = await ollama_1.default.chat({
                        model: 'deepseek-r1:latest',
                        messages: [{ role: 'user', content: userPrompt }],
                        stream: true,
                    });
                    // Handle streaming tokens
                    for await (const part of streamResponse) {
                        streamedResponse += part.message.content;
                        panel.webview.postMessage({
                            command: 'chatStream',
                            text: processResponse(streamedResponse, true),
                        });
                    }
                    // Once streaming is complete
                    panel.webview.postMessage({
                        command: 'chatComplete',
                        text: processResponse(streamedResponse, false),
                    });
                }
                catch (error) {
                    panel.webview.postMessage({
                        command: 'chatResponse',
                        text: `Error: ${String(error)}`,
                    });
                }
            }
        });
    });
    context.subscriptions.push(disposable);
}
/**
 * Post-processing of the AI's raw text:
 * 1) Convert <think> tags to a "Thinking..." placeholder with a toggle for full chain-of-thought.
 * 2) Keep the code-block export logic intact (regex for triple backticks).
 * 3) If the response is final (not streaming), wrap it in a minimal markdown-style container.
 */
function processResponse(response, isStreaming) {
    // 1) Replace <think> tags with a collapsible toggle
    response = response.replace(/<think>([\s\S]*?)<\/think>/g, (match, capturedContent) => {
        return `
        <div class="thinking-wrapper">
            <div class="thinking-summary">
                <em>Thinking...</em>
                <button class="toggle-btn" onclick="toggleThinking(this)">Show Full Thought</button>
            </div>
            <div class="thinking-full" style="display:none;">
                ${capturedContent.trim()}
            </div>
        </div>
        `;
    });
    // 2) KEEP your original code-block logic — do not remove or break
    response = response.replace(/```(\w+)?([\s\S]*?)```/g, (match, language, code) => {
        const lang = language || 'plaintext';
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
    // 3) For the final response, wrap the entire text in some markdown-like structure.
    if (!isStreaming) {
        response = `
<div class="md-output">
    <h3>Answer</h3>
    ${response}
</div>
        `;
    }
    // If still streaming, add the "typing..." indicator
    return isStreaming ? response + '<span class="typing">...</span>' : response;
}
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function getWebviewContent() {
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <style>
            /* Body reset + base styling */
            body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #f4f4f4;
                color: #333;
                height: 100vh;
                display: flex;
                flex-direction: column;
            }

            /* Header/Title styling */
            .header {
                background-color: #202123;
                color: #fff;
                padding: 1rem;
                text-align: center;
            }
            .header h2 {
                margin: 0;
                font-size: 1.2rem;
            }

            /* Chat container area */
            .chat-container {
                flex: 1; /* fill the remaining space */
                overflow-y: auto;
                padding: 1rem;
                box-sizing: border-box;
            }

            /* Individual messages */
            .message {
                margin-bottom: 1rem;
                max-width: 80%;
                line-height: 1.4;
                border-radius: 8px;
                padding: 0.8rem;
                word-wrap: break-word;
            }
            .user-message {
                margin-left: auto;
                background-color: #007bff;
                color: #ffffff;
            }
            .ai-message {
                margin-right: auto;
                background-color: #eaeaea;
                color: #333333;
            }

            /* Input bar at bottom */
            .input-container {
                display: flex;
                flex-direction: row;
                background-color: #fff;
                padding: 0.5rem;
                border-top: 1px solid #ccc;
            }
            .input-container textarea {
                flex: 1;
                resize: none;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 0.5rem;
                margin-right: 0.5rem;
                font-size: 14px;
                font-family: inherit;
            }
            .input-container button {
                background-color: #007bff;
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 0 1rem;
                cursor: pointer;
                font-size: 14px;
            }
            .input-container button:hover {
                background-color: #005bbd;
            }

            /* "Typing" indicator */
            .typing {
                color: #888;
                font-style: italic;
            }

            /* Minimal container for final markdown-like output */
            .md-output {
                border: 1px solid #ddd;
                background: #fff;
                padding: 1rem;
                margin-top: 0.5rem;
                border-radius: 6px;
            }
            .md-output h3 {
                margin-top: 0;
            }

            /* Code block styling */
            .code-block {
                border: 1px solid #ccc;
                border-radius: 8px;
                margin-top: 10px;
                overflow: hidden;
            }
            .code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: #333;
                color: #fff;
                padding: 5px 10px;
                font-size: 0.9rem;
            }
            .copy-btn {
                background-color: #007bff;
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 3px 8px;
                cursor: pointer;
            }
            .copy-btn:hover {
                background-color: #0056b3;
            }
            pre {
                margin: 0;
                padding: 1rem;
                background-color: #1e1e1e;
                color: #e8e8e8;
                overflow-x: auto;
                font-family: "Courier New", Courier, monospace;
            }

            /* Collapsible "thinking" content */
            .thinking-wrapper {
                border-left: 2px solid #ccc;
                margin: 0.5rem 0;
                padding-left: 0.5rem;
            }
            .thinking-summary {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                font-style: italic;
                color: #999;
            }
            .toggle-btn {
                background-color: #bbb;
                color: #333;
                border: none;
                border-radius: 4px;
                padding: 3px 8px;
                cursor: pointer;
                font-size: 0.8rem;
            }
            .thinking-full {
                margin-top: 0.5rem;
                padding: 0.5rem;
                border: 1px dashed #ccc;
                font-size: 0.9rem;
                background-color: #f9f9f9;
                white-space: pre-wrap;
            }
        </style>

        <!-- Prism.js for syntax highlighting -->
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-csharp.min.js"></script>
    </head>
    <body>
        <!-- Optional header to identify extension -->
        <div class="header">
            <h2>Deep Seek Chat</h2>
        </div>

        <!-- Chat messages container -->
        <div class="chat-container" id="chatContainer"></div>

        <!-- Input area at bottom -->
        <div class="input-container">
            <textarea id="prompt" rows="2" placeholder="Ask me anything..."></textarea>
            <button id="askBtn">Send</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chatContainer');
            const promptInput = document.getElementById('prompt');
            const askBtn = document.getElementById('askBtn');

            // Send user prompt to extension
            askBtn.addEventListener('click', () => {
                const text = promptInput.value.trim();
                if (!text) return;

                addMessage(text, 'user-message');
                vscode.postMessage({ command: 'chat', text });
                promptInput.value = '';
            });

            // Listen to messages from extension
            window.addEventListener('message', event => {
                const { command, text } = event.data;

                if (command === 'chatStream') {
                    // While tokens are streaming
                    updateLastMessage(text);
                } 
                else if (command === 'chatComplete') {
                    // On final token
                    updateLastMessage(text, true);
                }
                else if (command === 'chatResponse') {
                    // If an error or something else
                    addMessage(text, 'ai-message', true);
                }
            });

            // Add a new message div to the container
            function addMessage(content, className, isHtml = false) {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', className);

                if (isHtml) {
                    messageDiv.innerHTML = content;
                } else {
                    messageDiv.textContent = content;
                }

                chatContainer.appendChild(messageDiv);
                Prism.highlightAll();
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            // Update the most recent AI message (during streaming)
            function updateLastMessage(content, isFinal = false) {
                const lastMessage = chatContainer.lastElementChild;

                // If the last message is from the AI, update it
                if (lastMessage && lastMessage.classList.contains('ai-message')) {
                    lastMessage.innerHTML = content;
                    // Remove "..." after final token
                    if (isFinal) {
                        const typingIndicator = lastMessage.querySelector('.typing');
                        if (typingIndicator) typingIndicator.remove();
                    }
                } else {
                    // Otherwise, create a new AI message
                    addMessage(content, 'ai-message', true);
                }

                Prism.highlightAll();
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            // Copy code from code blocks
            function copyCode(button) {
                const code = button.parentElement.nextElementSibling.innerText;
                navigator.clipboard.writeText(code).then(() => {
                    button.textContent = 'Copied!';
                    setTimeout(() => (button.textContent = 'Copy'), 2000);
                });
            }

            // Toggle display of chain-of-thought
            function toggleThinking(btn) {
                const fullThought = btn.parentElement.nextElementSibling;
                if (fullThought.style.display === 'none') {
                    fullThought.style.display = 'block';
                    btn.textContent = 'Hide Full Thought';
                } else {
                    fullThought.style.display = 'none';
                    btn.textContent = 'Show Full Thought';
                }
            }
        </script>
    </body>
    </html>
    `;
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map