const { PDFParse } = require('pdf-parse');
async function test() {
    try {
        // Mock a simple PDF buffer or just check help
        console.log('PDFParse is indeed a function:', typeof PDFParse);
    } catch (e) {
        console.error(e);
    }
}
test();
