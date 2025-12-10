const CryptoJS = require("crypto-js");

const apiKey = "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"; // original API key
const secretKey = 'you-too-dumb-mehar-better'; // secret key

// Encrypt the API key
const encryptedApiKey = CryptoJS.AES.encrypt(apiKey, secretKey).toString();
console.log("Encrypted API Key:", encryptedApiKey); // Encrypted form of the original API key