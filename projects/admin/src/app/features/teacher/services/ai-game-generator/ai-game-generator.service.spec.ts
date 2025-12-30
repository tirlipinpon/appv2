import { TestBed } from '@angular/core/testing';
import { AIGameGeneratorService } from './ai-game-generator.service';

describe('AIGameGeneratorService', () => {
  let service: AIGameGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AIGameGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // TODO: Ajouter des tests unitaires pour les méthodes publiques
});

