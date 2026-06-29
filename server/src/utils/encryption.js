import CryptoJS from 'crypto-js';
import { env } from '../config/env.js';

export const encrypt = (text) => {
  return CryptoJS.AES.encrypt(text, env.encryptionKey).toString();
};

export const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, env.encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};
