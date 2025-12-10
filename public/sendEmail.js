// Email sending functionality via Cloudflare Worker
async function sendEvaluationEmail(sessionCode, transcript, linkId) {
    try {
        const response = await fetch('https://codethrough.tutor-tron.workers.dev', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'codethrough@tutor-tron.com',
                linkId,
                sessionCode,
                transcript
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send email');
        }

        return await response.json();
    } catch (error) {
        console.error('Error sending evaluation email:', error);
        throw error;
    }
}

export { sendEvaluationEmail };
