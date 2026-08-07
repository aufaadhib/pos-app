import { randomInt } from "node:crypto";

export function generateTemporaryPassword(length = 16) {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const pool = `${uppercase}${lowercase}${digits}${symbols}`;
  const required = [
    uppercase[randomInt(uppercase.length)],
    lowercase[randomInt(lowercase.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];
  const remaining = Array.from(
    { length: Math.max(12, length) - required.length },
    () => pool[randomInt(pool.length)],
  );
  const characters = [...required, ...remaining];
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
  return characters.join("");
}
