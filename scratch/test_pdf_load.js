const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function test() {
    try {
        const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
        
        console.log('Testing with load method...');
        const parser = new PDFParse(); // No args
        try {
            await parser.load(buffer);
            console.log('Loaded successfully.');
            const result = await parser.getText();
            console.log('Text:', result.text);
        } catch (e) {
            console.log('Load error:', e.message);
        }
        await parser.destroy();

    } catch (e) {
        console.error('Test failed:', e);
    }
}
test();
