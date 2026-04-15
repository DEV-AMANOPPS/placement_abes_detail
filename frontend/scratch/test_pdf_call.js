const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function test() {
    try {
        console.log('PDFParse type:', typeof PDFParse);
        // Let's try to call it (even with null, to see if it's a function that expects arguments)
        try {
            const result = await PDFParse(Buffer.from(''));
            console.log('Call result:', result);
        } catch (e) {
            console.log('Error calling PDFParse:', e.message);
        }
    } catch (e) {
        console.error(e);
    }
}
test();
