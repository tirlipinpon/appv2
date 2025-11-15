import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { AuthService, Profile } from '../../services/auth/auth.service';
import { ParentStore } from '../parent/store/index';
import { ChildStore } from '../child/store/index';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly parentStore = inject(ParentStore);
  readonly childStore = inject(ChildStore);
  profile: Profile | null = null;
  activeRole: string | null = null;
  private routerSubscription?: Subscription;

  // Computed signals pour le bouton parent
  readonly hasParent = computed(() => this.parentStore.hasParent());
  readonly parentButtonText = computed(() => this.hasParent() ? 'Éditer mon profil' : 'Créer mon profil');
  readonly isCreatingParent = computed(() => !this.hasParent());

  // Computed signals pour les enfants
  readonly children = computed(() => this.childStore.children());
  readonly activeChildren = computed(() => this.children().filter(c => c.is_active));
  readonly inactiveChildren = computed(() => this.children().filter(c => !c.is_active));
  readonly hasChildren = computed(() => this.childStore.hasChildren());
  readonly hasActiveChildren = computed(() => this.activeChildren().length > 0);
  readonly hasInactiveChildren = computed(() => this.inactiveChildren().length > 0);
  readonly childrenCount = computed(() => this.activeChildren().length);

  async ngOnInit() {
    this.profile = await this.authService.getProfile();
    this.activeRole = this.authService.getActiveRole();
    
    // Si le rôle actif est parent, charger le profil et vérifier le statut
    if (this.activeRole === 'parent') {
      this.parentStore.loadParentProfile();
      this.parentStore.checkParentStatus();
      this.childStore.loadChildren();
    }
    
    // Écouter les navigations pour recharger les enfants quand on revient au dashboard
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (event.url === '/dashboard' && this.activeRole === 'parent') {
          this.childStore.loadChildren();
        }
      });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  async logout() {
    await this.authService.signOut();
  }

  trackByChildId(index: number, child: any): string {
    return child.id;
  }

  setChildActiveStatus(childId: string, isActive: boolean, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!isActive && !confirm('Êtes-vous sûr de vouloir désactiver cet enfant ? Vous pourrez le réactiver plus tard.')) {
      return;
    }
    this.childStore.setChildActiveStatus({ childId, isActive });
  }
}
