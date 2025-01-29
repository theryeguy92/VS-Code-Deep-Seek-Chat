import * as vscode from 'vscode';
import ollama from 'ollama';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vs-deepseek-ext" is now active!');

    const disposable = vscode.commands.registerCommand('vs-deepseek-ext.helloWorld', () => {
        const panel = vscode.window.createWebviewPanel(
            'deepChat',
            'Deep Seek Chat',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(async (message: any) => {
            if (message.command === 'chat') {
                const userPrompt = message.text;
                let streamedResponse = '';

                try {
                    const streamResponse = await ollama.chat({
                        model: 'deepseek-r1:latest',
                        messages: [{ role: 'user', content: userPrompt }],
                        stream: true,
                    });

                    for await (const part of streamResponse) {
                        streamedResponse += part.message.content;
                        // Send intermediate results for streaming
                        panel.webview.postMessage({
                            command: 'chatStream',
                            text: processResponse(streamedResponse, true),
                        });
                    }

                    // Send the final response
                    panel.webview.postMessage({
                        command: 'chatComplete',
                        text: processResponse(streamedResponse, false),
                    });
                } catch (error) {
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
 * Process AI responses and detect code blocks.
 */
function processResponse(response: string, isStreaming: boolean): string {
    response = response.replace(/<think>/g, '<span class="think-tag">&lt;think&gt;</span>');
    response = response.replace(/<\/think>/g, '<span class="think-tag">&lt;/think&gt;</span>');

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

    return isStreaming ? response + '<span class="typing">...</span>' : response;
}

/**
 * Escape HTML entities for code rendering.
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Webview content with real-time streaming.
 */
function getWebviewContent(): string {
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
            .typing { color: #888; font-style: italic; } /* Typing indicator */
            .code-block { border: 1px solid #333; border-radius: 8px; overflow: hidden; margin-top: 10px; }
            .code-header { display: flex; justify-content: space-between; align-items: center; background-color: #333; color: #fff; padding: 5px 10px; font-size: 0.9rem; }
            .copy-btn { background-color: #007bff; color: #fff; border: none; border-radius: 4px; padding: 3px 8px; cursor: pointer; }
            .copy-btn:hover { background-color: #0056b3; }
            pre { background-color: #1e1e1e; color: #d4d4d4; padding: 1rem; margin: 0; overflow-x: auto; font-family: "Courier New", Courier, monospace; }
        </style>
    </head>
    <body>
        <h2>Deep VS Code Extension</h2>
        <div class="chat-container" id="chatContainer"></div>
        <div class="input-container">
            <textarea id="prompt"
            rows="4"
            placeholder="Ask me anything about your project!"
            style="
                width: 100%; 
                height: 120px; 
                padding: 10px; 
                border: 1px solid #555; 
                border-radius: 4px; 
                background-color: #333; 
                color: white; 
                font-size: 14px; 
                resize: none; /* Disable manual resizing */
                box-sizing: border-box;"></textarea>
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
                if (command === 'chatStream') {
                    updateLastMessage(text);
                } else if (command === 'chatComplete') {
                    updateLastMessage(text, true);
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

            function updateLastMessage(text, isFinal = false) {
                const lastMessage = chatContainer.lastElementChild;
                if (lastMessage && lastMessage.className === 'ai-message') {
                    lastMessage.innerHTML = text;
                    if (isFinal) {
                        const typingIndicator = lastMessage.querySelector('.typing');
                        if (typingIndicator) typingIndicator.remove();
                    }
                } else {
                    addMessage(text, 'ai-message', true);
                }
            }

            function copyCode(button) {
                const code = button.parentElement.nextElementSibling.innerText;
                navigator.clipboard.writeText(code).then(() => {
                    button.textContent = 'Copied!';
                    setTimeout(() => (button.textContent = 'Copy'), 2000);
                });
            }
        </script>
    </body>
    </html>
    `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
