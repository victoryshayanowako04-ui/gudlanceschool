const crypto = require('crypto');

const json = (statusCode, body) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
});

const hashCode = (code) =>
    crypto.createHash('sha256').update(String(code)).digest('hex');

async function supabaseRequest(path, options = {}) {
    const baseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    }

    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(text || `Supabase request failed (${response.status})`);
    return text ? JSON.parse(text) : null;
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

    try {
        const body = JSON.parse(event.body || '{}');
        const action = body.action;
        const userId = String(body.userId || '').trim();
        if (!userId) return json(400, { error: 'User ID is required.' });

        const users = await supabaseRequest(
            `users?select=id,name,username,role,data&id=eq.${encodeURIComponent(userId)}`
        );
        const user = users && users[0];
        if (!user) return json(404, { error: 'Account not found.' });

        const role = String(user.role || user.data?.role || '').toLowerCase();
        if (!role.includes('level 3') && role !== 'chief admin') {
            return json(403, { error: 'Two-factor verification is only required for Chief Admin accounts.' });
        }

        const userData = typeof user.data === 'string'
            ? JSON.parse(user.data || '{}')
            : (user.data || {});
        const email = String(user.email || userData.email || '').trim();
        if (!email) return json(400, { error: 'No verification email is configured for this Chief Admin account.' });

        if (action === 'send') {
            const resendKey = process.env.RESEND_API_KEY;
            if (!resendKey) return json(503, { error: 'RESEND_API_KEY is not configured on Netlify.' });

            const code = String(crypto.randomInt(100000, 1000000));
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            await supabaseRequest('chief_admin_verification_codes', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    code_hash: hashCode(code),
                    expires_at: expiresAt
                })
            });

            const fromEmail = process.env.MFA_FROM_EMAIL || 'Haven School <security@haven.school>';
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: [email],
                    subject: 'Haven Chief Admin verification code',
                    text: `Your Haven Chief Admin verification code is ${code}. It expires in 10 minutes.`,
                    html: `<p>Your Haven Chief Admin verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`
                })
            });
            if (!response.ok) {
                const detail = await response.text();
                return json(502, { error: `Verification email could not be sent: ${detail}` });
            }

            return json(200, { sent: true, maskedEmail: email.replace(/^(.{2}).*(@.*)$/, '$1***$2') });
        }

        if (action === 'verify') {
            const code = String(body.code || '').replace(/\D/g, '');
            if (!/^\d{6}$/.test(code)) return json(400, { error: 'Enter the 6-digit verification code.' });

            const records = await supabaseRequest(
                `chief_admin_verification_codes?select=id,code_hash,expires_at,verified_at&user_id=eq.${encodeURIComponent(userId)}&verified_at=is.null&order=created_at.desc&limit=1`
            );
            const record = records && records[0];
            if (!record) return json(400, { error: 'Request a new verification code.' });
            if (new Date(record.expires_at).getTime() < Date.now()) {
                return json(400, { error: 'The verification code has expired. Request a new one.' });
            }
            if (typeof record.code_hash !== 'string' ||
                record.code_hash.length !== hashCode(code).length) {
                return json(401, { error: 'Incorrect verification code.' });
            }
            if (crypto.timingSafeEqual(
                Buffer.from(record.code_hash),
                Buffer.from(hashCode(code))
            ) === false) {
                return json(401, { error: 'Incorrect verification code.' });
            }

            await supabaseRequest(`chief_admin_verification_codes?id=eq.${encodeURIComponent(record.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ verified_at: new Date().toISOString() })
            });
            return json(200, { verified: true });
        }

        return json(400, { error: 'Unknown action.' });
    } catch (error) {
        console.error('Chief Admin verification error:', error);
        return json(500, { error: error.message || 'Verification service failed.' });
    }
};
