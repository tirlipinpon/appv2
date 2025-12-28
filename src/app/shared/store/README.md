# Stores Redux (NgRx Signals)

Ce dossier contient les stores centralisés pour la gestion des données de l'application.

## Stores créés

### 1. SubjectsStore (`subjects.store.ts`)
- **État**: Toutes les matières, matières par école/niveau, matières par IDs
- **Cache**: Par école/niveau (`${schoolId}:${schoolLevel}`), par IDs
- **Méthodes principales**:
  - `loadAllSubjects()` - Charge toutes les matières
  - `loadSubjectsForSchoolLevel({ schoolId, schoolLevel })` - Charge les matières pour un niveau
  - `loadSubjectsByIds(ids[])` - Charge les matières par leurs IDs
  - `createSubject()`, `updateSubject()` - CRUD

### 2. SubjectCategoriesStore (`subject-categories.store.ts`)
- **État**: Catégories par matière
- **Cache**: Par matière (`subjectId`)
- **Méthodes principales**:
  - `loadCategoriesForSubject(subjectId)` - Charge les catégories d'une matière
  - `loadCategoriesBatch(subjectIds[])` - Charge en batch
  - `createCategory()`, `updateCategory()`, `deleteCategory()` - CRUD

### 3. ChildrenStore (`children.store.ts`)
- **État**: Liste des enfants, enfant courant, enfants par ID
- **Cache**: Par ID
- **Méthodes principales**:
  - `loadChildren()` - Charge tous les enfants du parent
  - `loadChildById(id)` - Charge un enfant spécifique
  - `createChild()`, `updateChild()`, `setActiveStatus()` - CRUD

### 4. SchoolsStore (`schools.store.ts`)
- **État**: Liste des écoles, écoles par ID
- **Cache**: Global (données statiques)
- **Méthodes principales**:
  - `loadSchools()` - Charge toutes les écoles
  - `loadSchoolById(id)` - Charge une école spécifique
  - `createSchool()`, `updateSchool()` - CRUD

### 5. GameTypesStore (`game-types.store.ts`)
- **État**: Liste des types de jeux, types par ID
- **Cache**: Global (données statiques)
- **Méthodes principales**:
  - `loadGameTypes()` - Charge tous les types de jeux

### 6. EnrollmentsStore (`enrollments.store.ts`)
- **État**: Inscriptions matière et catégories par enfant
- **Cache**: Par enfant (`childId`)
- **Méthodes principales**:
  - `loadEnrollments(childId)` - Charge les inscriptions matière
  - `loadCategoryEnrollments(childId)` - Charge les inscriptions catégories
  - `upsertEnrollment()`, `upsertCategoryEnrollment()`, `upsertCategoryEnrollmentsBatch()` - CRUD

## Stores enrichis

### GamesStore (`features/teacher/store/games.store.ts`)
- **Ajout**: Stats batch par matière et par catégorie
- **Nouvelles méthodes**:
  - `loadStatsBySubjectsBatch({ subjectIds, skipAssignmentCheck })` - Charge les stats en batch
  - `loadStatsByCategoriesBatch(categoryIds[])` - Charge les stats catégories en batch
  - `clearStatsCache()` - Efface le cache des stats

## Migration en cours

Les services suivants doivent être migrés pour utiliser les nouveaux stores :

1. `SubjectService` → Utiliser `SubjectsStore`
2. `ParentSubjectService` → Utiliser `SubjectsStore`, `SubjectCategoriesStore`, `EnrollmentsStore`
3. `ChildService` → Utiliser `ChildrenStore`
4. `SchoolService` → Utiliser `SchoolsStore`
5. `GameTypeService` → Utiliser `GameTypesStore`
6. `CategoriesCacheService` → Remplacé par `SubjectCategoriesStore`
7. `GamesStatsService` → Intégré dans `GamesStore`

## Utilisation

```typescript
import { SubjectsStore } from '@shared/store/subjects.store';

// Dans un composant
export class MyComponent {
  private readonly subjectsStore = inject(SubjectsStore);

  ngOnInit() {
    // Charger les matières pour un niveau
    this.subjectsStore.loadSubjectsForSchoolLevel({ 
      schoolId: 'xxx', 
      schoolLevel: 'P1' 
    });
    
    // Accéder aux données
    const subjects = this.subjectsStore.subjectsBySchoolLevel();
  }
}
```

## Avantages

1. **Cache centralisé**: Évite les appels backend répétés
2. **État réactif**: Les composants se mettent à jour automatiquement
3. **Performance**: Chargement batch et cache intelligent
4. **Cohérence**: Une seule source de vérité pour les données

