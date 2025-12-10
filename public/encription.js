const CryptoJS = require("crypto-js");


const secretKey = 'you-too-dumb-mehar-better'; // secret key

// Encrypt the API key
const encryptedApiKey = CryptoJS.AES.encrypt(apiKey, secretKey).toString();
console.log("Encrypted API Key:", encryptedApiKey); // Encrypted form of the original API key
