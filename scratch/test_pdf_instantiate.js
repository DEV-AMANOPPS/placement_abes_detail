const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function test() {
    try {
        console.log('PDFParse type:', typeof PDFParse);
        // Let's try to instantiate it
        try {
            const instance = new PDFParse(Buffer.from(''));
            console.log('Instance:', instance);
            // Check if it has a method like parse or then (if it's a promise)
            console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
        } catch (e) {
            console.log('Error instantiating PDFParse:', e.message);
        }
    } catch (e) {
        console.error(e);
    }
}
test();
