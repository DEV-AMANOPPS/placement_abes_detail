const { PDFParse } = require('pdf-parse');

async function test() {
    try {
        console.log('Testing with {} as options...');
        const parser = new PDFParse({});
        console.log('Parser instance created.');
        await parser.destroy();
    } catch (e) {
        console.log('Error with {}:', e.message);
    }

    try {
        console.log('\nTesting with { data: buffer }...');
        const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
        const parser = new PDFParse({ data: buffer });
        console.log('Parser instance created with data.');
        await parser.destroy();
    } catch (e) {
        console.log('Error with data:', e.message);
    }
}
test();
