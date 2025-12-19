import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Game } from '../../../../types/game';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
  @Input({ required: true }) game!: Game;
  @Input({ required: true }) gameTypeName!: string;

  @Output() edit = new EventEmitter<Game>();
  @Output() delete = new EventEmitter<string>();

  onEdit(): void {
    this.edit.emit(this.game);
  }

  onDelete(): void {
    this.delete.emit(this.game.id);
  }
}

