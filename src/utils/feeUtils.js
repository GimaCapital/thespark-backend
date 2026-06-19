// src/utils/feeUtils.js

// ============ WITHDRAWAL FEE CALCULATION ============
const calculateWithdrawalFee = (amount) => {
    let fee = 0;
    
    if (amount <= 1000) {
        fee = 20;
    } else if (amount <= 3000) {
        fee = 50;
    } else if (amount <= 5000) {
        fee = 100;
    } else if (amount <= 10000) {
        fee = 200;
    } else if (amount <= 20000) {
        fee = 300;
    } else if (amount <= 30000) {
        fee = 500;
    } else if (amount <= 40000) {
        fee = 800;
    } else if (amount <= 50000) {
        fee = 1000;
    } else if (amount <= 100000) {
        fee = 1500;
    } else if (amount <= 150000) {
        fee = 2000;
    } else if (amount <= 200000) {
        fee = 2500;
    } else if (amount <= 300000) {
        fee = 3000;
    } else if (amount <= 500000) {
        fee = 6000;
    } else {
        fee = 10000;
    }
    
    return { 
        fee,
        totalFee: fee
    };
};

module.exports = { calculateWithdrawalFee };