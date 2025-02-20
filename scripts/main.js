// 全局变量
let messageHistory = [];

// DOM 元素
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const messageContainer = document.getElementById('messageContainer');

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 添加消息到聊天界面
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message--${isUser ? 'user' : 'ai'}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message__avatar';
    avatarDiv.innerHTML = `<img src="images/${isUser ? 'user' : 'ai'}-avatar.png" alt="${isUser ? '用户' : 'AI'}头像">`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message__content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    messageContainer.appendChild(messageDiv);
    
    // 滚动到最新消息
    messageContainer.scrollTop = messageContainer.scrollHeight;
    
    // 更新消息历史
    messageHistory.push({
        role: isUser ? 'user' : 'assistant',
        content: content
    });
}

// 发送消息到服务器
async function sendMessage(message) {
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messageHistory
            })
        });

        if (!response.ok) {
            throw new Error('网络请求失败');
        }

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';

        while (true) {
            const {value, done} = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value);
            aiResponse += text;
            
            // 更新AI回复内容
            const aiMessageDiv = document.querySelector('.message--ai:last-child .message__content');
            if (aiMessageDiv) {
                aiMessageDiv.textContent = aiResponse;
            }
        }

        // 完成后添加到消息历史
        messageHistory.push({
            role: 'assistant',
            content: aiResponse
        });

    } catch (error) {
        console.error('发送消息失败:', error);
        addMessage('抱歉，发生了一些错误。请稍后再试。', false);
    }
}

// 处理表单提交
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // 显示用户消息
    addMessage(message, true);
    
    // 清空输入框
    userInput.value = '';
    
    // 显示AI正在输入的提示
    addMessage('正在思考...', false);
    
    // 发送消息到服务器
    await sendMessage(message);
});

// 输入框自动调整高度
userInput.addEventListener('input', debounce(() => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
}, 100));