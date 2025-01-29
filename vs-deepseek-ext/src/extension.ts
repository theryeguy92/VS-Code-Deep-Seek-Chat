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
                let responseText = '';

                try {
                    const streamResponse = await ollama.chat({
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
                } catch (error) {
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
function processResponse(response: string): string {
    // Wrap <think> tags with custom styling
    response = response.replace(/<think>/g, '<span class="think-tag">&lt;think&gt;</span>');
    response = response.replace(/<\/think>/g, '<span class="think-tag">&lt;/think&gt;</span>');

    // Handle code blocks
    response = response.replace(/```(\w+)?([\s\S]*?)```/g, (match, language, code) => {
        const lang = language || 'plaintext'; // Default to plaintext if no language is specified
        return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
    });

    // Return the processed response (already escaped)
    return response;
}

/**
 * Escape HTML entities to prevent rendering issues.
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
 * Webview content with minimal JavaScript.
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
        .input-container { display: flex; margin-top: 1rem; }
        textarea { flex: 1; padding: 0.5rem; border: 1px solid #555; border-radius: 4px; background-color: #333; color: white; }
        button { margin-left: 0.5rem; padding: 0.5rem 1rem; border: none; border-radius: 4px; background-color: #007bff; color: white; cursor: pointer; }
        button:hover { background-color: #0056b3; }
        pre { background-color: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; overflow-x: auto; font-family: "Courier New", Courier, monospace; }
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
        </script>
    </body>
    </html>
    `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
