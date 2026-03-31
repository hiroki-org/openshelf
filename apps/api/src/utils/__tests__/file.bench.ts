import { bench, describe } from 'vitest';
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

    bench('validateMagicNumbers pptx', async () => {
        // Minimal ZIP with a central-directory entry named ppt/presentation.xml
        const name = new TextEncoder().encode('ppt/presentation.xml');
        const localHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

        const cdEntry = new Uint8Array(46 + name.length);
        const view = new DataView(cdEntry.buffer);
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(28, name.length, true);
        cdEntry.set(name, 46);

        const eocd = new Uint8Array(22);
        const eocdView = new DataView(eocd.buffer);
        eocdView.setUint32(0, 0x06054b50, true);
        eocdView.setUint16(10, 1, true);
        eocdView.setUint32(12, cdEntry.length, true);
        eocdView.setUint32(16, localHeader.length, true);

        const bytes = new Uint8Array(localHeader.length + cdEntry.length + eocd.length);
        bytes.set(localHeader, 0);
        bytes.set(cdEntry, localHeader.length);
        bytes.set(eocd, localHeader.length + cdEntry.length);

        const file = new File(
            [bytes],
            'slides.pptx',
            { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
        );
        await validateMagicNumbers(
            file,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        );
    });
});
