const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/SimulatedDashboards.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Substituir o botão de JPEG
const searchJpeg = `<button \r\n                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors"`;
const searchJpegLF = `<button \n                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors"`;

if (content.includes(searchJpeg)) {
  console.log("Found JPEG button with CRLF!");
  content = content.replace(searchJpeg, `<GlossyButton \r\n                                variant="blue"`);
} else if (content.includes(searchJpegLF)) {
  console.log("Found JPEG button with LF!");
  content = content.replace(searchJpegLF, `<GlossyButton \n                                variant="blue"`);
} else {
  // Vamos tentar usar regex para achar e substituir a tag inicial do botão de JPEG
  console.log("JPEG button exact match not found, trying regex...");
  content = content.replace(/<button\s*[\r\n]+\s*className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors"/, '<GlossyButton variant="blue"');
}

// Fechamento do botão de JPEG
// Buscando o </button> que vem logo após {loadingExport ? "Gerando..." : "Exportar Imagem (JPEG)"}
content = content.replace(/\{\s*loadingExport\s*\?\s*"Gerando\.\.\."\s*:\s*"Exportar Imagem \(JPEG\)"\s*\}\s*<\/button>/, '{loadingExport ? "Gerando..." : "Exportar Imagem (JPEG)"}</GlossyButton>');


// 2. Substituir o botão de XLSX
const searchXlsx = `className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700 transition-colors"`;
if (content.includes(searchXlsx)) {
  console.log("Found XLSX class!");
}
// Vamos usar regex para o botão XLSX
content = content.replace(/<button\s*[\r\n]+\s*className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700 transition-colors"/, '<GlossyButton variant="yellow"');
// Fechamento do XLSX
content = content.replace(/>Exportar XLSX<\/button>/, '>Exportar XLSX</GlossyButton>');


// 3. Substituir o botão de Fechar
content = content.replace(/<button onClick=\{\(\) => setViewDoc\(null\)\} className="px-4 py-2 bg-slate-200 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors">Fechar<\/button>/, '<GlossyButton onClick={() => setViewDoc(null)} variant="gray">Fechar</GlossyButton>');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done!");
