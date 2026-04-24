exports.handler = async (event) => {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: 'Missing env vars', token: !!BOT_TOKEN, chat: !!CHAT_ID })
        };
    }

    try {
        const contentType = event.headers['content-type'] || '';

        // Xử lý FormData (upload file)
        if (contentType.includes('multipart/form-data')) {
            const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
            const boundary = contentType.split('boundary=')[1];
            
            const parts = {};
            const str = bodyBuffer.toString('binary');
            const sections = str.split(`--${boundary}`);

            for (const section of sections) {
                const nameMatch = section.match(/name="([^"]+)"/);
                const filenameMatch = section.match(/filename="([^"]+)"/);
                if (!nameMatch) continue;
                
                const name = nameMatch[1];
                const filename = filenameMatch ? filenameMatch[1] : null;
                
                const headerEnd = section.indexOf('\r\n\r\n');
                if (headerEnd === -1) continue;
                
                let dataStart = headerEnd + 4;
                let dataEnd = section.lastIndexOf('\r\n');
                if (dataEnd <= dataStart) dataEnd = section.length;
                
                const data = Buffer.from(section.substring(dataStart, dataEnd), 'binary');
                
                if (filename) {
                    parts[name] = { data, filename };
                } else {
                    parts[name] = data.toString('utf8').trim();
                }
            }

            const endpoint = parts['endpoint'];
            const caption = parts['caption'] || '';
            
            // Tìm field file (audio/photo/document)
            const fileField = parts['audio'] || parts['photo'] || parts['document'];
            
            if (!endpoint || !fileField) {
                return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing endpoint or file' }) };
            }

            const FormData = require('form-data');
            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            if (caption) form.append('caption', caption);
            form.append(
                Object.keys(parts).find(k => ['audio', 'photo', 'document'].includes(k)),
                fileField.data,
                { filename: fileField.filename }
            );

            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
                method: 'POST',
                headers: form.getHeaders(),
                body: form
            });

            const result = await res.json();
            return { statusCode: 200, body: JSON.stringify(result) };
        }

        // Xử lý JSON
        const body = JSON.parse(event.body);
        const { endpoint, data } = body;

        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, ...data })
        });

        const result = await res.json();
        return { statusCode: 200, body: JSON.stringify(result) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
    }
};
