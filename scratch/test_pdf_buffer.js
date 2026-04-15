const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function test() {
    try {
        // Create a minimal PDF buffer (this is not a valid PDF but lets see if it accepts it)
        const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
        
        console.log('Testing with buffer...');
        const parser = new PDFParse(buffer);
        console.log('Parser state after load:', parser.progress);
        
        try {
            const result = await parser.getText();
            console.log('Text result keys:', Object.keys(result));
            console.log('Text content:', result.text);
        } catch (e) {
            console.log('getText error:', e.message);
        }
        
        await parser.destroy();
        console.log('Destroyed.');

        // Let's try passing it in an object
        console.log('\nTesting with data in object...');
        const parser2 = new PDFParse({ data: buffer });
        const result2 = await parser2.getText();
        console.log('Text content from parser2:', result2.text);
        await parser2.destroy();

    } catch (e) {
        console.error('Test failed:', e);
    }
}
test();
