// /netlify/functions/pay.js
const crypto = require('crypto');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { studentId, amount, parentEmail } = JSON.parse(event.body);

        // 1. Grab keys and strip any accidental invisible spaces
        
         
        // FOR TESTING ONLY - DO NOT PASTE YOUR REAL KEYS IN OUR CHAT!
        const PAYNOW_ID = process.env.PAYNOW_ID ? process.env.PAYNOW_ID.trim() : "";
        const PAYNOW_KEY = process.env.PAYNOW_KEY ? process.env.PAYNOW_KEY.trim() : "";
        const reference = "INV-" + studentId + "-" + Date.now();
        const host = event.headers.host;
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const returnUrl = `${protocol}://${host}/?payment=success`; 
        const resultUrl = `${protocol}://${host}/.netlify/functions/receipt`;

        // 2. Build the payload (NO SPACES ALLOWED for maximum safety)
        let payload = {
            additionalinfo: `Tuition-${studentId}`, 
            amount: Number(amount).toFixed(2),
            id: PAYNOW_ID,
            reference: `INV-${studentId}-${Date.now()}`,
            resulturl: resultUrl,
            returnurl: returnUrl,
            status: 'Message'
        };

        // ONLY add authemail if it actually exists, to prevent Hash Mismatches
        if (parentEmail) {
            payload.authemail = parentEmail;
        }

        // 3. CREATE THE DIGITAL SIGNATURE (Strict Alphabetical Sort)
        let stringToHash = "";
        const sortedKeys = Object.keys(payload).sort();
        
        for (const key of sortedKeys) {
            stringToHash += payload[key];
        }
        stringToHash += PAYNOW_KEY; 
        
        const hash = crypto.createHash('sha512').update(stringToHash).digest('hex').toUpperCase();
        payload.hash = hash;

        // 4. Send to Paynow
        const formData = new URLSearchParams(payload).toString();
        const response = await fetch('https://www.paynow.co.zw/interface/initiatetransaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const textResponse = await response.text();
        const resultData = new URLSearchParams(textResponse);

        if (resultData.get('status') === 'Ok') {
            return { statusCode: 200, body: JSON.stringify({ success: true, link: resultData.get('browserurl') }) };
        } else {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: resultData.get('error') }) };
        }

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: "Server Error: " + error.message }) };
    }
};