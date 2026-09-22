const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'sorteio', '[id]', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Make file mandatory
content = content.replace(
  `    let proofUrl = null;
    if (selectedFile) {
      proofUrl = await new Promise((resolve) => {`,
  `    if (!selectedFile) {
      alert("Você deve enviar um comprovante!");
      return;
    }

    let proofUrl = null;
    if (selectedFile) {
      proofUrl = await new Promise((resolve) => {`
);

// Remove (OPCIONAL) text
content = content.replace(
  `COMPROVANTE (OPCIONAL)`,
  `COMPROVANTE (OBRIGATÓRIO)`
);

// If there are other places with (OPCIONAL)
content = content.replace(
  `Comprovante (Opcional)`,
  `Comprovante (Obrigatório)`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated sorteio page.tsx');
