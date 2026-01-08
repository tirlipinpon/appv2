# Documentation des Risques - Migration 012_fix_check_constraints

## 📋 Vue d'ensemble

Cette migration corrige les problèmes de contraintes CHECK identifiés dans le schéma de base de données.

**Date de migration:** 2024-12-XX  
**Fichier:** `012_fix_check_constraints.sql`  
**Rollback:** `012_fix_check_constraints_rollback.sql`

---

## ⚠️ RISQUES IDENTIFIÉS

### 🔴 RISQUE CRITIQUE: Aucun

Aucun risque critique identifié. Les corrections sont **sûres** car :
- Les patterns regex sont **plus stricts** (pas de chaîne vide)
- Les valeurs existantes dans la base respectent déjà les nouveaux patterns
- Aucune donnée existante ne sera rejetée

### 🟡 RISQUES MOYENS

#### 1. `teacher_assignments.school_level` - Changement de comportement

**Problème:**
- **Avant:** La contrainte permettait `NULL` via `(school_level IS NULL) OR ...`
- **Après:** La contrainte ne permet plus `NULL` (cohérent avec `NOT NULL` + `DEFAULT ''`)

**Impact:**
- ✅ **Aucun impact sur les données existantes** (la colonne est `NOT NULL` avec `DEFAULT ''`)
- ⚠️ **Code TypeScript:** Si du code essaie d'insérer `NULL`, cela échouera maintenant (mais c'était déjà le cas à cause de `NOT NULL`)

**Fichiers TypeScript à vérifier:**
- `projects/admin/src/app/features/teacher/services/teacher-assignment/teacher-assignment.service.ts`
- `projects/admin/src/app/features/teacher/components/assignments/components/add-assignment-dialog/add-assignment-dialog.component.ts`

**Action préventive:**
```typescript
// Vérifier que le code utilise toujours '' au lieu de null
school_level: (assignmentData.school_level ?? '') as string
```

#### 2. `school_level_subjects.school_level` - Ajout de 'Autre'

**Problème:**
- **Avant:** Seulement `M[1-3]|P[1-6]|S[1-6]` autorisés
- **Après:** `M[1-3]|P[1-6]|S[1-6]|Autre` autorisés

**Impact:**
- ✅ **Aucun impact sur les données existantes** (aucune valeur 'Autre' actuellement)
- ⚠️ **Code TypeScript:** Le code peut maintenant insérer 'Autre' dans cette table

**Fichiers TypeScript à vérifier:**
- `projects/admin/src/app/features/teacher/components/subjects/subjects.component.ts`
- `projects/admin/src/app/features/child/services/subject/parent-subject.service.ts`

**Action préventive:**
- Vérifier que les formulaires/admin permettent de sélectionner 'Autre' si nécessaire

### 🟢 RISQUES FAIBLES

#### 3. Patterns regex plus stricts

**Problème:**
- **Avant:** Pattern `|)` permettait chaîne vide
- **Après:** Pattern strict sans `|)`

**Impact:**
- ✅ **Aucun impact** - Aucune chaîne vide dans les données existantes
- ✅ **Protection améliorée** - Empêche l'insertion de chaînes vides à l'avenir

#### 4. Gestion NULL explicite dans `questions` et `subjects`

**Problème:**
- **Avant:** `= ANY (ARRAY[...])` sans gestion NULL explicite
- **Après:** `IS NULL OR = ANY (ARRAY[...])`

**Impact:**
- ✅ **Aucun changement de comportement** - Les colonnes sont déjà `NULLABLE`
- ✅ **Clarté améliorée** - Le CHECK est maintenant explicite sur NULL

---

## 📝 CHECKLIST AVANT MIGRATION

- [x] Vérifier qu'aucune chaîne vide n'existe dans `children.school_level`
- [x] Vérifier qu'aucune chaîne vide n'existe dans `teacher_assignments.school_level`
- [x] Vérifier qu'aucune valeur 'Autre' n'existe dans `school_level_subjects.school_level`
- [x] Vérifier que les valeurs NULL dans `questions.question_type` sont acceptables
- [x] Vérifier que les valeurs NULL dans `questions.difficulty` sont acceptables
- [x] Vérifier que les valeurs NULL dans `subjects.type` sont acceptables

---

## 🔍 VÉRIFICATIONS POST-MIGRATION

### Requêtes de vérification

```sql
-- 1. Vérifier qu'aucune contrainte n'a été cassée
SELECT 
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
    AND tc.table_name IN ('children', 'teacher_assignments', 'school_level_subjects', 'questions', 'subjects')
ORDER BY tc.table_name, tc.constraint_name;

-- 2. Vérifier qu'aucune donnée existante ne viole les nouvelles contraintes
SELECT 'children' as table_name, COUNT(*) as invalid_count
FROM children
WHERE school_level IS NOT NULL 
  AND school_level !~ '^(M[1-3]|P[1-6]|S[1-6]|Autre)$'
UNION ALL
SELECT 'teacher_assignments', COUNT(*)
FROM teacher_assignments
WHERE school_level !~ '^(M[1-3]|P[1-6]|S[1-6]|Autre|)$'
UNION ALL
SELECT 'school_level_subjects', COUNT(*)
FROM school_level_subjects
WHERE school_level !~ '^(M[1-3]|P[1-6]|S[1-6]|Autre)$'
UNION ALL
SELECT 'questions.question_type', COUNT(*)
FROM questions
WHERE question_type IS NOT NULL
  AND question_type NOT IN ('qcm', 'vrai_faux', 'texte', 'numerique')
UNION ALL
SELECT 'questions.difficulty', COUNT(*)
FROM questions
WHERE difficulty IS NOT NULL
  AND difficulty NOT IN ('facile', 'moyen', 'difficile')
UNION ALL
SELECT 'subjects.type', COUNT(*)
FROM subjects
WHERE type IS NOT NULL
  AND type NOT IN ('scolaire', 'extra', 'optionnelle');
```

**Résultat attendu:** Tous les `invalid_count` doivent être `0`

---

## 🔄 PROCÉDURE DE ROLLBACK

Si un problème survient après la migration :

1. **Arrêter l'application** pour éviter les insertions pendant le rollback
2. **Exécuter le script de rollback:**
   ```sql
   \i supabase/migrations/012_fix_check_constraints_rollback.sql
   ```
3. **Vérifier que les contraintes sont restaurées:**
   ```sql
   SELECT constraint_name, check_clause
   FROM information_schema.check_constraints
   WHERE constraint_schema = 'public'
     AND constraint_name LIKE '%school_level%'
     OR constraint_name LIKE '%question_type%'
     OR constraint_name LIKE '%difficulty%'
     OR constraint_name LIKE '%type%';
   ```
4. **Redémarrer l'application**

---

## 📊 IMPACT SUR LE CODE TYPESCRIPT

### Fichiers potentiellement affectés

1. **`projects/admin/src/app/features/teacher/services/teacher-assignment/teacher-assignment.service.ts`**
   - Ligne 57: `school_level: (assignmentData.school_level ?? '') as string`
   - ✅ **OK** - Utilise déjà `''` comme fallback

2. **`projects/admin/src/app/features/teacher/components/assignments/components/add-assignment-dialog/add-assignment-dialog.component.ts`**
   - Ligne 74: `school_level: ['', Validators.required]`
   - ✅ **OK** - Utilise déjà `''` comme valeur par défaut

3. **`projects/admin/src/app/features/child/child.component.ts`**
   - Ligne 162: `school_level: ['']`
   - ✅ **OK** - Utilise déjà `''` comme valeur par défaut

4. **`projects/admin/src/app/features/teacher/components/subjects/subjects.component.ts`**
   - Ligne 180: Gestion de `school_level`
   - ⚠️ **À vérifier** - S'assurer que 'Autre' peut être utilisé dans `school_level_subjects`

### Aucun changement de code nécessaire

Les corrections sont **rétrocompatibles** avec le code existant car :
- Les valeurs par défaut utilisent déjà `''` (chaîne vide)
- Les patterns sont plus stricts mais acceptent toutes les valeurs existantes
- La gestion NULL est maintenant explicite mais ne change pas le comportement

---

## ✅ CONCLUSION

**Migration sûre à exécuter** ✅

- Aucun risque de perte de données
- Aucun risque de casser le code existant
- Amélioration de la cohérence et de la sécurité des contraintes
- Rollback disponible si nécessaire
