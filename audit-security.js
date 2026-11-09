const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache']);
const ALLOWED_EXTS = new Set(['.js', '.ts', '.json', '.env', '.rules', '.html']);

const SECURITY_PATTERNS = [
  {
    category: 'Credencial / Segredo Exposto',
    regex: /(?:api[_-]?key|secret|token|password|auth_token)\s*[:=]\s*["'][A-Za-z0-9_\-\.]{16,}["']/i,
    severity: 'ALTA'
  },
  {
    category: 'Chave de API do Google / Firebase Exposta em Backend',
    regex: /AIzaSy[A-Za-z0-9_-]{33}/,
    severity: 'MÉDIA'
  },
  {
    category: 'Regra de Banco Aberta (Firestore/Realtime)',
    regex: /allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true\s*;/i,
    severity: 'CRÍTICA'
  },
  {
    category: 'CORS Totalmente Permissivo',
    regex: /res\.setHeader\s*\(\s*["']Access-Control-Allow-Origin["']\s*,\s*["']\*["']\s*\)|cors\(\s*\{\s*origin\s*:\s*["']\*["']\s*\}\s*\)/i,
    severity: 'MÉDIA'
  },
  {
    category: 'Log Potencialmente Sensível',
    regex: /console\.log\s*\(\s*.*(?:token|senha|password|req\.headers|auth).*?\)/i,
    severity: 'BAIXA'
  }
];

let findings = [];

function scanFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return;
  }

  const lines = content.split('\n');

  lines.forEach((line, index) => {
    SECURITY_PATTERNS.forEach(pattern => {
      if (pattern.regex.test(line)) {
        findings.push({
          file: path.relative(process.cwd(), filePath),
          line: index + 1,
          category: pattern.category,
          severity: pattern.severity,
          snippet: line.trim().slice(0, 100)
        });
      }
    });
  });
}

function traverseDirectory(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        traverseDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ALLOWED_EXTS.has(ext) || entry.name.startsWith('.env')) {
        scanFile(fullPath);
      }
    }
  }
}

console.log('🔍 Iniciando auditoria de segurança estática no projeto...\n');
traverseDirectory(process.cwd());

if (findings.length === 0) {
  console.log('✅ Nenhum padrão crítico comum encontrado.');
} else {
  console.log(`⚠️ Foram encontradas ${findings.length} ocorrência(s):\n`);

  findings.forEach((item, idx) => {
    console.log(`[${idx + 1}] Gravidade: ${item.severity}`);
    console.log(`    Problema: ${item.category}`);
    console.log(`    Arquivo : ${item.file}:${item.line}`);
    console.log(`    Trecho  : ${item.snippet}`);
    console.log('--------------------------------------------------');
  });

  console.log('\n💡 Recomendações:');
  console.log('1. Mova segredos para variáveis de ambiente fora do Git.');
  console.log('2. Garanta que regras de banco restrinjam acesso a usuários autenticados.');
  console.log('3. Execute sempre `npm audit` para checar pacotes de terceiros.');
}
