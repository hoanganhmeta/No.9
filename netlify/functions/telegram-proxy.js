exports.handler = async (event) => {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    if (!BOT_TOKEN || !CHAT_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables' })
        };
    }

    try {
        // Nếu là FormData (upload file: ảnh, audio, document)
        if (event.headers['content-type']?.includes('multipart/form-data')) {
            const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
            const boundary = event.headers['content-type'].split('boundary=')[1];
            const parts = parseMultipart(bodyBuffer, boundary);
            
            const endpoint = parts.find(p => p.name === 'endpoint')?.data.toString();
            const fileFields = ['audio', 'photo', 'document'];
            const filePart = parts.find(p => fileFields.includes(p.name));
            const caption = parts.find(p => p.name === 'caption')?.data.toString() || '';

            const formData = new FormData();
            formData.append('chat_id', CHAT_ID);
            if (caption) formData.append('caption', caption);
            formData.append(filePart.name, new Blob([filePart.data], { type: 'application/octet-stream' }), filePart.filename || 'file');

            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
                method: 'POST',
                body: formData
            });
            return { statusCode: 200, body: JSON.stringify(await res.json()) };
        }

        // Nếu là JSON (sendMessage)
        const { endpoint, data } = JSON.parse(event.body);
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, ...data })
        });
        return { statusCode: 200, body: JSON.stringify(await res.json()) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

function parseMultipart(buffer, boundary) {
    const parts = [];
    const str = buffer.toString('binary');
    const sections = str.split(`--${boundary}`);

    for (const section of sections) {
        if (!section.includes('Content-Disposition')) continue;
        
        const nameMatch = section.match(/name="([^"]+)"/);
        const filenameMatch = section.match(/filename="([^"]+)"/);
        const name = nameMatch?.[1];
        const filename = filenameMatch?.[1] || null;

        const headerEnd = section.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
            let dataStart = headerEnd + 4;
            let dataEnd = section.lastIndexOf('\r\n');
            if (dataEnd <= dataStart) dataEnd = section.length;
            
            parts.push({
                name,
                filename,
                data: Buffer.from(section.substring(dataStart, dataEnd), 'binary')
            });
        }
    }
    return parts;
}
