#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

/**
 * Vérifie si Git est disponible et si on est dans un repository Git
 */
function isGitRepository() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Récupère le dernier tag Git ou null si aucun tag n'existe
 */
function getLastTag() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    return tag;
  } catch {
    return null;
  }
}

/**
 * Récupère les commits depuis la dernière version/tag
 */
function getCommitsSinceVersion(currentVersion) {
  try {
    const lastTag = getLastTag();
    let range;
    
    if (lastTag) {
      // Utiliser le tag comme point de départ
      range = `${lastTag}..HEAD`;
    } else {
      // Si aucun tag, analyser tous les commits depuis le début
      range = 'HEAD';
    }
    
    const commits = execSync(`git log ${range} --format=%s`, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim().length > 0);
    
    return commits;
  } catch (error) {
    console.warn(`⚠️  Avertissement: Impossible de récupérer les commits Git: ${error.message}`);
    return [];
  }
}

/**
 * Détecte le type de version basé sur les commits (MAJOR/MINOR/PATCH)
 */
function detectVersionType(commits) {
  if (!commits || commits.length === 0) {
    return 'patch'; // Par défaut, incrémenter PATCH
  }

  let hasMajor = false;
  let hasMinor = false;

  for (const commit of commits) {
    const commitMessage = commit.trim();
    
    // Détecter MAJOR : BREAKING CHANGE ou ! dans le type
    if (
      commitMessage.includes('BREAKING CHANGE:') ||
      commitMessage.includes('BREAKING CHANGE') ||
      /^[a-z]+(\([^)]+\))?!:/i.test(commitMessage) ||
      /^[a-z]+!:/i.test(commitMessage)
    ) {
      hasMajor = true;
      break; // MAJOR a la priorité absolue
    }
    
    // Détecter MINOR : feat:
    if (/^feat(\([^)]+\))?:/i.test(commitMessage)) {
      hasMinor = true;
    }
  }

  // Ordre de priorité : MAJOR > MINOR > PATCH
  if (hasMajor) {
    return 'major';
  } else if (hasMinor) {
    return 'minor';
  } else {
    return 'patch';
  }
}

/**
 * Incrémente la version selon le type détecté
 */
function incrementVersion(versionParts, versionType) {
  const major = parseInt(versionParts[0], 10);
  const minor = parseInt(versionParts[1], 10);
  const patch = parseInt(versionParts[2], 10);

  switch (versionType) {
    case 'major':
      return [`${major + 1}`, '0', '0'];
    case 'minor':
      return [versionParts[0], `${minor + 1}`, '0'];
    case 'patch':
    default:
      return [versionParts[0], versionParts[1], `${patch + 1}`];
  }
}

try {
  // Vérifier si on est dans un repository Git
  const isGit = isGitRepository();
  
  if (!isGit) {
    console.warn('⚠️  Avertissement: Pas de repository Git détecté. Utilisation de PATCH par défaut.');
  }

  // Lire package.json
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);

  // Vérifier que la version existe
  if (!packageJson.version) {
    console.error('❌ Erreur: La propriété "version" est absente de package.json');
    process.exit(1);
  }

  // Parser la version (format semver: MAJOR.MINOR.PATCH)
  const versionParts = packageJson.version.split('.');
  
  if (versionParts.length !== 3) {
    console.warn(`⚠️  Avertissement: Format de version invalide "${packageJson.version}". Utilisation de "0.0.0" par défaut.`);
    packageJson.version = '0.0.0';
    versionParts[0] = '0';
    versionParts[1] = '0';
    versionParts[2] = '0';
  }

  // Vérifier que chaque partie est un nombre
  const major = parseInt(versionParts[0], 10);
  const minor = parseInt(versionParts[1], 10);
  const patch = parseInt(versionParts[2], 10);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    console.warn(`⚠️  Avertissement: Version invalide "${packageJson.version}". Utilisation de "0.0.0" par défaut.`);
    packageJson.version = '0.0.0';
    versionParts[0] = '0';
    versionParts[1] = '0';
    versionParts[2] = '0';
  }

  const oldVersion = packageJson.version;
  let versionType = 'patch'; // Par défaut
  let commits = [];

  // Analyser les commits Git si disponible
  if (isGit) {
    commits = getCommitsSinceVersion(oldVersion);
    versionType = detectVersionType(commits);
    
    if (commits.length > 0) {
      console.log(`📝 ${commits.length} commit(s) analysé(s) depuis la dernière version`);
      console.log(`🔍 Type de version détecté: ${versionType.toUpperCase()}`);
    } else {
      console.log('📝 Aucun nouveau commit détecté depuis la dernière version');
      console.log(`🔍 Utilisation du type par défaut: ${versionType.toUpperCase()}`);
    }
  } else {
    console.log(`🔍 Utilisation du type par défaut: ${versionType.toUpperCase()} (pas de Git)`);
  }

  // Incrémenter la version selon le type détecté
  const newVersionParts = incrementVersion(versionParts, versionType);
  packageJson.version = newVersionParts.join('.');

  // Écrire le package.json mis à jour
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8'
  );

  console.log(`✅ Version incrémentée: ${oldVersion} → ${packageJson.version} (${versionType.toUpperCase()})`);
  
  if (commits.length > 0 && commits.length <= 5) {
    console.log('\n📋 Commits analysés:');
    commits.forEach((commit, index) => {
      console.log(`   ${index + 1}. ${commit}`);
    });
  }
} catch (error) {
  console.error('❌ Erreur lors de l\'incrémentation de la version:', error.message);
  process.exit(1);
}
