import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const generate = customAlphabet(alphabet, 10);

export const generateReference = (prefix) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${generate()}`;
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
