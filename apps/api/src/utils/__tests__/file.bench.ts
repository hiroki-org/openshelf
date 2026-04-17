import { bench, describe } from 'vitest';
import { validateMagicNumbers } from '../file';

describe('file extensions benchmark', () => {
    async function validateRepeatedly(file: File, mime: string) {
        let isValid = true;
        for (let i = 0; i < 100; i++) {
            isValid = (await validateMagicNumbers(file, mime)) && isValid;
        }

        if (!isValid) {
            throw new Error(`Expected ${mime} validation to succeed`);
        }
    }

    // Create dummy File objects matching signatures once to avoid allocation overhead during benchmark
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]);
    const pdfFile = new File([pdfMagic], 'sample.pdf', { type: 'application/pdf' });

    bench('validateMagicNumbers pdf', async () => {
        await validateRepeatedly(pdfFile, 'application/pdf');
    });

    const pngMagic = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const pngFile = new File([pngMagic], 'image.png', { type: 'image/png' });

    bench('validateMagicNumbers png', async () => {
        await validateRepeatedly(pngFile, 'image/png');
    });
});
