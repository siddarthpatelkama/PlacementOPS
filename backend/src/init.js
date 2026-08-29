import dotenv from 'dotenv';
dotenv.config();

if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {};
}