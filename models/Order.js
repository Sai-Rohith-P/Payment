const mongoose = require('../Db.js');

const orderSchema = new mongoose.Schema({
    order_id: String,
    amount: Number,
    currency: String,
    status: String,
    createdAt: { type: Date, default: Date.now },
    paidAt: Date,
    payment_id: String,
    signature: String,
    lastCheckedAt: Date
});

module.exports = mongoose.model('Order', orderSchema);
