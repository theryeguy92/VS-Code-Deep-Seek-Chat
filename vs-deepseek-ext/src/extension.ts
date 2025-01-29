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

        // Serve the chat UI in the Webview
        panel.webview.html = getWebviewContent();

        // Listen for messages from the Webview
        panel.webview.onDidReceiveMessage(async (message: any) => {
            if (message.command === 'chat') {
                const userPrompt = message.text;
                let streamedResponse = '';

                try {
                    // Stream content from the Ollama LLM
                    const streamResponse = await ollama.chat({
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

function processResponse(response: string, isStreaming: boolean): string {
    // Replace <think> tags with a stylized placeholder
    response = response.replace(/<think>/g, '<span class="think-tag">&lt;think&gt;</span>');
    response = response.replace(/<\/think>/g, '<span class="think-tag">&lt;/think&gt;</span>');

    // Handle code blocks
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

    // If streaming, add a "..." or a typing indicator
    return isStreaming ? response + '<span class="typing">...</span>' : response;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getWebviewContent(): string {
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

            /* Header/Title styling (if you want to keep it) */
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

            /* User messages: align right, different background */
            .user-message {
                margin-left: auto;
                background-color: #007bff;
                color: #ffffff;
            }

            /* AI messages: align left, lighter background */
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

            /* Subtle italic style for thinking tags */
            .think-tag {
                font-style: italic;
                color: #888;
            }

            /* "Typing" indicator */
            .typing {
                color: #888;
                font-style: italic;
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

                // While tokens are streaming in
                if (command === 'chatStream') {
                    updateLastMessage(text);
                }
                // On final token
                else if (command === 'chatComplete') {
                    updateLastMessage(text, true);
                }
                // If an error or something else
                else if (command === 'chatResponse') {
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
        </script>
    </body>
    </html>
    `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
