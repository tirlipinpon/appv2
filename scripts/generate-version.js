#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const versionTsPath = path.join(__dirname, '..', 'src', 'app', 'core', 'version.ts');

try {
  // Lire package.json
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);

  // Vérifier que la version existe
  if (!packageJson.version) {
    console.error('❌ Erreur: La propriété "version" est absente de package.json');
    process.exit(1);
  }

  // Vérifier que le répertoire existe
  const versionDir = path.dirname(versionTsPath);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  // Générer le contenu du fichier version.ts
  const versionContent = `// Ce fichier est généré automatiquement. Ne pas modifier manuellement.
// Généré depuis package.json

export const APP_VERSION = '${packageJson.version}';
`;

  // Écrire le fichier version.ts
  fs.writeFileSync(versionTsPath, versionContent, 'utf8');

  console.log(`✅ Fichier version.ts généré avec la version: ${packageJson.version}`);
} catch (error) {
  console.error('❌ Erreur lors de la génération du fichier version.ts:', error.message);
  process.exit(1);
}

