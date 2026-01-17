#!/usr/bin/env node

require('dotenv').config();
const { Client } = require('basic-ftp');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement
const FTP_HOST = process.env.FTP_HOST;
const FTP_PORT = parseInt(process.env.FTP_PORT || '21', 10);
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
// Destination pour le frontend : appv2/frontend
const FTP_DESTINATION = process.env.FTP_DESTINATION_FRONTEND || 'appv2/frontend';

// Chemin source (dossier dist généré par Angular pour frontend)
const sourceDir = path.join(__dirname, '..', 'dist', 'frontend', 'browser');

/**
 * Vérifie que toutes les variables d'environnement sont définies
 */
function validateEnv() {
  const required = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Erreur: Variables d'environnement manquantes: ${missing.join(', ')}`);
    console.error('💡 Assurez-vous que le fichier .env existe et contient toutes les variables nécessaires.');
    process.exit(1);
  }
}

/**
 * Vérifie que le dossier source existe
 */
function validateSourceDir() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Erreur: Le dossier source n'existe pas: ${sourceDir}`);
    console.error('💡 Assurez-vous d\'avoir exécuté "npm run build:frontend" avant de déployer.');
    process.exit(1);
  }
}

/**
 * Supprime récursivement un dossier sur le serveur FTP
 */
async function removeDirectory(client, dirPath) {
  try {
    const files = await client.list(dirPath);
    
    for (const file of files) {
      const filePath = dirPath + '/' + file.name;
      
      if (file.isDirectory) {
        await removeDirectory(client, filePath);
        await client.removeDir(filePath);
      } else {
        await client.remove(filePath);
      }
    }
  } catch (error) {
    // Le dossier n'existe peut-être pas encore, ce n'est pas grave
    if (error.code !== 550) {
      throw error;
    }
  }
}

/**
 * Upload récursif d'un dossier vers le serveur FTP
 * Utilise des chemins relatifs car on est déjà dans le répertoire de destination
 */
async function uploadDirectory(client, localDir, remoteDir) {
  const files = fs.readdirSync(localDir);
  let uploadedCount = 0;
  
  for (const file of files) {
    const localPath = path.join(localDir, file);
    const stat = fs.statSync(localPath);
    
    if (stat.isDirectory()) {
      // Créer le dossier sur le serveur (chemin relatif)
      const remotePath = remoteDir === '.' ? file : remoteDir + '/' + file;
      const currentDir = await client.pwd();
      
      try {
        // ensureDir crée le dossier ET y navigue automatiquement
        // Si ensureDir réussit, on est déjà dans le bon répertoire, pas besoin de cd
        try {
          await client.ensureDir(remotePath);
          // ensureDir a réussi, on est dans le bon répertoire, continuer
        } catch (mkdirError) {
          // Si ensureDir échoue, essayer de naviguer manuellement
          if (mkdirError.code === 550 || mkdirError.message?.includes('550')) {
            // Erreur 550 = le dossier existe peut-être déjà mais ensureDir a échoué
            // Essayer de naviguer dans le dossier existant
            try {
              await client.cd(remotePath);
            } catch (cdError) {
              // Si cd échoue aussi, le dossier n'existe peut-être pas vraiment
              // Réessayer ensureDir (peut-être que ça marchera cette fois)
              try {
                await client.ensureDir(remotePath);
              } catch (retryError) {
                // Si ça échoue encore, essayer cd une dernière fois
                await client.cd(remotePath);
              }
            }
          } else {
            // Autre type d'erreur, la propager
            throw mkdirError;
          }
        }
        
        // Upload récursif
        const count = await uploadDirectory(client, localPath, '.');
        uploadedCount += count;
        
        // Revenir au répertoire parent
        await client.cd('..');
      } catch (error) {
        console.error(`❌ Erreur lors du traitement du répertoire ${remotePath}: ${error.message}`);
        // Revenir au répertoire précédent en cas d'erreur
        try {
          await client.cd(currentDir);
        } catch {
          // Ignorer si on ne peut pas revenir
        }
        throw error;
      }
    } else {
      // Upload le fichier (chemin relatif)
      const remotePath = remoteDir === '.' ? file : remoteDir + '/' + file;
      console.log(`  📤 Upload: ${file} (${(stat.size / 1024).toFixed(2)} KB)`);
      await client.uploadFrom(localPath, remotePath);
      uploadedCount++;
    }
  }
  
  return uploadedCount;
}

/**
 * Fonction principale de déploiement
 */
async function deploy() {
  console.log('🚀 Démarrage du déploiement FTP pour le frontend...\n');
  
  // Valider les variables d'environnement
  validateEnv();
  
  // Valider le dossier source
  validateSourceDir();
  
  const client = new Client();
  client.ftp.verbose = true; // Afficher les logs FTP
  
  try {
    console.log(`📡 Connexion au serveur FTP: ${FTP_HOST}:${FTP_PORT}`);
    await client.access({
      host: FTP_HOST,
      port: FTP_PORT,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false, // FTP standard (pas FTPS)
      secureOptions: undefined
    });
    
    console.log('✅ Connexion FTP établie\n');
    
    // Vérifier que le dossier de destination existe, sinon le créer
    console.log(`📁 Vérification du dossier de destination: ${FTP_DESTINATION}`);
    try {
      // ensureDir crée le répertoire et change dedans automatiquement
      await client.ensureDir(FTP_DESTINATION);
      console.log(`✅ Répertoire de destination créé et sélectionné\n`);
    } catch (error) {
      console.error(`❌ Erreur lors de la création du dossier de destination: ${error.message}`);
      throw error;
    }
    
    // Supprimer les fichiers existants dans la destination
    console.log(`🗑️  Suppression des fichiers existants dans ${FTP_DESTINATION}...`);
    try {
      // On est déjà dans le répertoire de destination, donc on supprime le contenu du répertoire courant
      const files = await client.list('.');
      for (const file of files) {
        if (file.name === '.' || file.name === '..') continue;
        
        const filePath = file.name;
        if (file.isDirectory) {
          await removeDirectory(client, filePath);
          await client.removeDir(filePath);
        } else {
          await client.remove(filePath);
        }
      }
      console.log('✅ Fichiers existants supprimés\n');
    } catch (error) {
      console.warn(`⚠️  Avertissement lors de la suppression: ${error.message}`);
      console.log('⏭️  Continuation du déploiement...\n');
    }
    
    // Vérifier le répertoire courant avant l'upload
    const currentDir = await client.pwd();
    console.log(`📍 Répertoire courant FTP: ${currentDir}\n`);
    
    // Upload des fichiers (on utilise '.' car on est déjà dans le répertoire de destination)
    console.log(`📤 Upload des fichiers depuis ${sourceDir} vers ${FTP_DESTINATION}...`);
    const uploadedCount = await uploadDirectory(client, sourceDir, '.');
    
    // Vérifier le répertoire après l'upload
    const finalDir = await client.pwd();
    console.log(`\n✅ Déploiement terminé avec succès!`);
    console.log(`📊 ${uploadedCount} fichier(s) uploadé(s)`);
    console.log(`📍 Fichiers déployés dans: ${finalDir}`);
    
  } catch (error) {
    console.error(`\n❌ Erreur lors du déploiement: ${error.message}`);
    if (error.code) {
      console.error(`   Code d'erreur: ${error.code}`);
    }
    process.exit(1);
  } finally {
    client.close();
  }
}

// Exécuter le déploiement
deploy().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
