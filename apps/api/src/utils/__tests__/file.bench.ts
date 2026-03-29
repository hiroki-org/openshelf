import { bench, describe } from 'vitest';
import { getFileExtension } from '../file';

describe('file extensions benchmark', () => {
    bench('getFileExtension pdf', () => {
        getFileExtension('sample.pdf', 'application/pdf');
    });

    bench('getFileExtension json', () => {
        getFileExtension('data.json', 'application/json');
    });
});
