import { normalizeSteamId, validateSteamId } from './src/shared/utils/validation.js';

console.log('Testing BOT ID validation:');
console.log('BOT_1_Sublime:', validateSteamId('BOT_1_Sublime'), '|', normalizeSteamId('BOT_1_Sublime'));
console.log('BOT_1_-Sh0rTy-:', validateSteamId('BOT_1_-Sh0rTy-'), '|', normalizeSteamId('BOT_1_-Sh0rTy-'));
console.log('BOT:', validateSteamId('BOT'), '|', normalizeSteamId('BOT'));
console.log('BOT:name:', validateSteamId('BOT:name'), '|', normalizeSteamId('BOT:name'));
console.log('Invalid:', validateSteamId('INVALID_ID'), '|', normalizeSteamId('INVALID_ID'));
