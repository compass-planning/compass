const {generatePdfFromHtml} = require('./dist/server/services/pdfService.js');
generatePdfFromHtml('<html><body><h1>Test</h1></body></html>')
  .then(b => console.log('PDF size:', b.length))
  .catch(e => console.error('Error:', e.message));
