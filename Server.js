const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('./Db.js'); // MongoDB connection
const Order = require('./models/Order');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Create Razorpay order
async function createRazorpayOrder(amount, currency = 'INR', receipt = 'rcpt_' + Date.now()) {
    const body = { amount, currency, receipt, payment_capture: 1 };
    const url = 'https://api.razorpay.com/v1/orders';
    const basicAuth = 'Basic ' + Buffer.from(RAZORPAY_KEY_ID + ':' + RAZORPAY_KEY_SECRET).toString('base64');

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': basicAuth },
        body: JSON.stringify(body)
    });
    return await resp.json();
}

// Create order endpoint
app.post('/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount) return res.status(400).json({ error: 'amount required in paise' });

        const order = await createRazorpayOrder(amount);

        await Order.create({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            status: order.status || 'created'
        });

        return res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error', details: err.message });
    }
});

// Verify payment endpoint
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
            return res.status(400).json({ error: 'incomplete parameters' });

        const generated_signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature === razorpay_signature) {
            await Order.findOneAndUpdate({ order_id: razorpay_order_id }, {
                payment_id: razorpay_payment_id,
                signature: razorpay_signature,
                status: 'paid',
                paidAt: new Date()
            });
            return res.json({ verified: true });
        } else {
            await Order.findOneAndUpdate({ order_id: razorpay_order_id }, {
                status: 'payment_verification_failed',
                lastCheckedAt: new Date()
            });
            return res.status(400).json({ verified: false });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error', details: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
