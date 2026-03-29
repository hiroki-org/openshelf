const fs = require('fs');

const benchContent = `import { bench, describe } from 'vitest';
import { validateMagicNumbers } from '../file';

describe('file extensions benchmark', () => {
    bench('validateMagicNumbers pdf', async () => {
        // Create a dummy File object matching a PDF signature
        const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]);
        const file = new File([pdfMagic], 'sample.pdf', { type: 'application/pdf' });
        await validateMagicNumbers(file, 'application/pdf');
    });

    bench('validateMagicNumbers png', async () => {
        // Create a dummy File object matching a PNG signature
        const pngMagic = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const file = new File([pngMagic], 'image.png', { type: 'image/png' });
        await validateMagicNumbers(file, 'image/png');
    });
});`;

fs.writeFileSync('apps/api/src/utils/__tests__/file.bench.ts', benchContent);
