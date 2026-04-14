import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/lib/encryption.js';

describe('Encryption', () => {
  it('round-trip: encrypt then decrypt returns original', () => {
    const plaintext = 'Hello, BerlinKeys!';
    const ciphertext = encrypt(plaintext);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('different plaintexts produce different ciphertexts', () => {
    const a = encrypt('text-a');
    const b = encrypt('text-b');
    expect(a).not.toBe(b);
  });

  it('same plaintext produces different ciphertexts (random IV)', () => {
    const a = encrypt('same-text');
    const b = encrypt('same-text');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const ciphertext = encrypt('');
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe('');
  });

  it('handles unicode (German characters)', () => {
    const text = 'Straße Über Mädchen Größe';
    const decrypted = decrypt(encrypt(text));
    expect(decrypted).toBe(text);
  });
});
