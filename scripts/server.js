const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

// API配置
const API_KEY = process.env.API_KEY || '8f70e72f-7045-4066-af1d-d8a1728faf89';
const API_URL = process.env.API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const MAX_RETRIES = 3;
const TIMEOUT = 30000; // 30秒超时

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 根路径处理
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
});

// 系统提示词
const SYSTEM_MESSAGE = {
    role: 'system',
    content: '你是一位专业的Life Coach，擅长通过对话帮助他人进行个人成长。你会以友善、专业的态度倾听用户的问题，给出有建设性的建议和指导。你的回答应该具有同理心，并且注重实用性，帮助用户找到适合自己的成长路径。'
};

// 带重试的API请求函数
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), TIMEOUT);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`第${i + 1}次请求失败，正在重试...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// 处理聊天请求
app.post('/chat', async (req, res) => {
    try {
        // 设置响应头，支持流式输出
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // 准备请求数据
        const messages = [SYSTEM_MESSAGE, ...req.body.messages];

        // 调用DeepSeek API
        const response = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'ep-20250218221402-7mr55',
                messages: messages,
                temperature: 0.6,
                stream: true
            })
        });

        // 使用更可靠的方式处理流式响应
        const stream = response.body;
        if (!stream) {
            throw new Error('无法获取响应流');
        }

        // 设置编码器
        const decoder = new TextDecoder();
        let buffer = '';

        // 创建流读取器
        for await (const chunk of stream) {
            // 解码数据块并添加到缓冲区
            buffer += decoder.decode(chunk, { stream: true });

            // 处理完整的数据行
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留最后一个不完整的行

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr === '[DONE]') continue;

                        const json = JSON.parse(jsonStr);
                        if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                            res.write(json.choices[0].delta.content);
                        }
                    }
                } catch (e) {
                    console.error('解析响应数据失败:', e, '\n原始数据:', line);
                }
            }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
            try {
                if (buffer.startsWith('data: ')) {
                    const jsonStr = buffer.slice(6);
                    if (jsonStr !== '[DONE]') {
                        const json = JSON.parse(jsonStr);
                        if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                            res.write(json.choices[0].delta.content);
                        }
                    }
                }
            } catch (e) {
                console.error('解析最后的响应数据失败:', e, '\n原始数据:', buffer);
            }
        }

        // 完成响应
        res.end();

    } catch (error) {
        console.error('处理请求失败:', error);
        res.status(500).json({ error: '服务器内部错误，请稍后重试' });
    }
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
    console.log(`服务器运行在 http://0.0.0.0:${port}`);
});