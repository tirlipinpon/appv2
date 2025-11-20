# Charte Graphique - Design System

## Vue d'ensemble

Ce document décrit la charte graphique complète de l'application. Tous les composants doivent utiliser ce design system pour garantir une cohérence visuelle dans toute l'application.

## Structure des fichiers

Le design system est organisé en plusieurs fichiers SCSS :

- `src/styles/_variables.scss` - Variables de design (couleurs, espacements, typographie, etc.)
- `src/styles/_mixins.scss` - Mixins réutilisables pour les composants
- `src/styles/_utilities.scss` - Classes utilitaires réutilisables
- `src/styles/_animations.scss` - Animations et transitions

## Palette de couleurs

### Couleurs primaires (Violet)

- **Primary** : `#667eea` - Couleur principale de l'application
- **Primary Dark** : `#5568d3` - Variante sombre pour les états hover
- **Primary Light** : `#8b9ef0` - Variante claire
- **Primary Lighter** : `#e8ebff` - Variante très claire pour les backgrounds

**Variables SCSS :**

```scss
$color-primary: #667eea;
$color-primary-dark: #5568d3;
$color-primary-light: #8b9ef0;
$color-primary-lighter: #e8ebff;
```

### Couleurs secondaires

- **Secondary** : `#6c757d` - Couleur secondaire
- **Secondary Dark** : `#545b62`
- **Secondary Light** : `#868e96`
- **Secondary Lighter** : `#e9ecef`

### Couleurs sémantiques

#### Succès

- **Success** : `#28a745`
- **Success Dark** : `#218838`
- **Success Lighter** : `#d4edda`

#### Danger

- **Danger** : `#dc3545`
- **Danger Dark** : `#c82333`
- **Danger Lighter** : `#f8d7da`

#### Avertissement

- **Warning** : `#ffc107`
- **Warning Dark** : `#e0a800`
- **Warning Lighter** : `#fff3cd`

#### Info

- **Info** : `#17a2b8`
- **Info Dark** : `#138496`
- **Info Lighter** : `#d1ecf1`

### Nuances de gris

- `$color-gray-50` : `#f8f9fa`
- `$color-gray-100` : `#f5f5f5`
- `$color-gray-200` : `#eeeeee`
- `$color-gray-300` : `#dee2e6`
- `$color-gray-400` : `#ced4da`
- `$color-gray-500` : `#adb5bd`
- `$color-gray-600` : `#6c757d`
- `$color-gray-700` : `#495057`
- `$color-gray-800` : `#343a40`
- `$color-gray-900` : `#212529`

### Couleurs de texte

- **Primary** : `#333333` - Texte principal
- **Secondary** : `#666666` - Texte secondaire
- **Tertiary** : `#999999` - Texte tertiaire
- **Disabled** : `#cccccc` - Texte désactivé
- **Inverse** : `#ffffff` - Texte sur fond sombre

### Couleurs de fond

- **Primary** : `#ffffff` - Fond principal
- **Secondary** : `#f5f5f5` - Fond secondaire
- **Tertiary** : `#f8f9fa` - Fond tertiaire
- **Overlay** : `rgba(0, 0, 0, 0.5)` - Overlay pour modales

## Typographie

### Famille de police

```scss
$font-family-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Tailles de police

- **XS** : `0.75rem` (12px)
- **SM** : `0.875rem` (14px)
- **Base** : `1rem` (16px)
- **LG** : `1.125rem` (18px)
- **XL** : `1.25rem` (20px)
- **2XL** : `1.5rem` (24px)
- **3XL** : `1.875rem` (30px)
- **4XL** : `2.25rem` (36px)

### Poids de police

- **Light** : `300`
- **Normal** : `400`
- **Medium** : `500`
- **Semibold** : `600`
- **Bold** : `700`

### Hauteurs de ligne

- **Tight** : `1.25`
- **Normal** : `1.5`
- **Relaxed** : `1.75`

## Espacements

Le système d'espacement utilise une échelle de 4px :

- **XS** : `4px`
- **SM** : `8px`
- **MD** : `16px`
- **LG** : `24px`
- **XL** : `32px`
- **2XL** : `48px`
- **3XL** : `64px`

## Bordures

### Rayons de bordure

- **XS** : `2px`
- **SM** : `4px`
- **MD** : `8px`
- **LG** : `12px`
- **XL** : `16px`
- **Full** : `9999px` (cercle complet)

### Largeurs de bordure

- **Thin** : `1px`
- **Medium** : `2px`
- **Thick** : `3px`

## Ombres

- **XS** : `0 1px 2px rgba(0, 0, 0, 0.05)`
- **SM** : `0 2px 4px rgba(0, 0, 0, 0.1)`
- **MD** : `0 4px 8px rgba(0, 0, 0, 0.1)`
- **LG** : `0 8px 16px rgba(0, 0, 0, 0.1)`
- **XL** : `0 12px 24px rgba(0, 0, 0, 0.15)`
- **2XL** : `0 16px 32px rgba(0, 0, 0, 0.2)`

## Transitions

- **Fast** : `0.15s ease`
- **Base** : `0.2s ease`
- **Slow** : `0.3s ease`

## Composants

### Boutons

#### Utilisation des classes

```html
<button class="btn btn-primary">Bouton principal</button>
<button class="btn btn-secondary">Bouton secondaire</button>
<button class="btn btn-success">Succès</button>
<button class="btn btn-danger">Danger</button>
<button class="btn btn-outline-primary">Outline</button>
```

#### Tailles

```html
<button class="btn btn-primary btn-sm">Petit</button>
<button class="btn btn-primary">Normal</button>
<button class="btn btn-primary btn-lg">Grand</button>
```

#### Utilisation des mixins

```scss
.my-button {
  @include button-base;
  @include button-variant($color-primary, $color-white, $color-primary-dark);
}
```

### Cartes

#### Utilisation des classes

```html
<div class="card">
  <div class="card-header">En-tête</div>
  <div class="card-body">Contenu</div>
  <div class="card-footer">Pied de page</div>
</div>
```

#### Utilisation des mixins

```scss
.my-card {
  @include card-base;
}
```

### Formulaires

#### Utilisation des classes

```html
<div class="form-group">
  <label class="form-label">Label</label>
  <input type="text" class="form-control" />
  <span class="form-error">Message d'erreur</span>
</div>
```

#### Utilisation des mixins

```scss
.my-form-group {
  @include input-group;
}
```

### Badges

#### Utilisation des classes

```html
<span class="badge badge-primary">Badge</span>
<span class="badge badge-success">Succès</span>
<span class="badge badge-outline-primary">Outline</span>
```

#### Utilisation des mixins

```scss
.my-badge {
  @include badge-base;
  @include badge-variant($color-primary);
}
```

### Alertes

#### Utilisation des classes

```html
<div class="alert alert-success">Message de succès</div>
<div class="alert alert-danger">Message d'erreur</div>
<div class="alert alert-warning">Avertissement</div>
<div class="alert alert-info">Information</div>
```

#### Utilisation des mixins

```scss
.my-alert {
  @include alert-base;
  @include alert-variant($color-success-lighter, $color-success);
}
```

## Classes utilitaires

### Texte

```html
<p class="text-primary">Texte primaire</p>
<p class="text-secondary">Texte secondaire</p>
<p class="text-success">Texte succès</p>
<p class="text-danger">Texte danger</p>
<p class="text-xs">Petit texte</p>
<p class="text-sm">Texte petit</p>
<p class="text-lg">Texte grand</p>
<p class="font-bold">Texte gras</p>
```

### Espacements

```html
<div class="m-md">Marge moyenne</div>
<div class="p-lg">Padding grand</div>
<div class="mt-xl">Marge top extra-large</div>
```

### Display

```html
<div class="d-flex">Flexbox</div>
<div class="d-grid">Grid</div>
<div class="d-none">Caché</div>
```

### Flexbox

```html
<div class="d-flex justify-between align-center gap-md">
  <!-- Contenu -->
</div>
```

## Breakpoints

- **SM** : `576px`
- **MD** : `768px`
- **LG** : `992px`
- **XL** : `1200px`

### Utilisation

```scss
.my-component {
  padding: $spacing-md;

  @include respond-to(md) {
    padding: $spacing-xl;
  }
}
```

## Z-index

- **Base** : `1`
- **Dropdown** : `1000`
- **Sticky** : `1020`
- **Fixed** : `1030`
- **Modal Backdrop** : `1040`
- **Modal** : `1050`
- **Popover** : `1060`
- **Tooltip** : `1070`
- **Toast** : `1080`

## États

- **Disabled Opacity** : `0.6`
- **Hover Opacity** : `0.8`
- **Overlay Opacity** : `0.5`

## Bonnes pratiques

1. **Toujours utiliser les variables** : Ne jamais utiliser de valeurs en dur (couleurs, espacements, etc.)
2. **Utiliser les mixins** : Préférer les mixins aux classes utilitaires pour les composants réutilisables
3. **Cohérence** : Respecter les espacements et les tailles définis dans le design system
4. **Accessibilité** : Toujours inclure les états focus et hover
5. **Responsive** : Utiliser les breakpoints pour les adaptations mobiles

## Exemples d'utilisation

### Créer un nouveau composant

```scss
@use "../../../styles/variables" as *;
@use "../../../styles/mixins" as *;

.my-component {
  @include card-base;
  padding: $spacing-xl;

  .my-button {
    @include button-base;
    @include button-variant($color-primary, $color-white, $color-primary-dark);
  }

  .my-input {
    @include form-control-base;
  }
}
```

### Créer une variante de bouton

```scss
.btn-custom {
  @include button-base;
  @include button-variant($color-success, $color-white, $color-success-dark);
  padding: $spacing-md $spacing-xl;
}
```

## Migration

Pour migrer un composant existant vers le design system :

1. Importer les variables et mixins
2. Remplacer toutes les valeurs en dur par des variables
3. Utiliser les mixins appropriés pour les composants
4. Supprimer les styles redondants
5. Tester visuellement pour s'assurer de la cohérence

## Support

Pour toute question ou suggestion concernant le design system, veuillez contacter l'équipe de développement.
