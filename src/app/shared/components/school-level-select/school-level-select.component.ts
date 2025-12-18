import { Component, Input, forwardRef, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormsModule } from '@angular/forms';

interface SchoolLevelOption { value: string; label: string }

@Component({
	selector: 'app-school-level-select',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, FormsModule],
	templateUrl: './school-level-select.component.html',
	styleUrl: './school-level-select.component.scss',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => SchoolLevelSelectComponent),
			multi: true,
		},
	],
})
export class SchoolLevelSelectComponent implements ControlValueAccessor {
	@Input() label = 'Niveau scolaire';
	@Input() required = false;
	@Input() disabled = false;
	@Input() id: string | undefined;

	private onChange: (value: string | null) => void = () => undefined;
	private onTouched: () => void = () => undefined;

	private readonly autoId = `school-level-${Math.random().toString(36).slice(2)}`;
	readonly selectId = computed(() => this.id ?? this.autoId);

	readonly value = signal<string | null>(null);
	readonly isDisabled = signal<boolean>(false);

	readonly options: SchoolLevelOption[] = [
		{ value: 'M1', label: 'M1 (Maternelle 1ère - 3 ans)' },
		{ value: 'M2', label: 'M2 (Maternelle 2ème - 4 ans)' },
		{ value: 'M3', label: 'M3 (Maternelle 3ème - 5 ans)' },
		{ value: 'P1', label: 'P1 (Primaire 1ère - 6 ans)' },
		{ value: 'P2', label: 'P2 (Primaire 2ème - 7 ans)' },
		{ value: 'P3', label: 'P3 (Primaire 3ème - 8 ans)' },
		{ value: 'P4', label: 'P4 (Primaire 4ème - 9 ans)' },
		{ value: 'P5', label: 'P5 (Primaire 5ème - 10 ans)' },
		{ value: 'P6', label: 'P6 (Primaire 6ème - 11 ans)' },
		{ value: 'S1', label: 'S1 (Secondaire 1ère - 12 ans)' },
		{ value: 'S2', label: 'S2 (Secondaire 2ème - 13 ans)' },
		{ value: 'S3', label: 'S3 (Secondaire 3ème - 14 ans)' },
		{ value: 'S4', label: 'S4 (Secondaire 4ème - 15 ans)' },
		{ value: 'S5', label: 'S5 (Secondaire 5ème - 16 ans)' },
		{ value: 'S6', label: 'S6 (Secondaire 6ème - 17 ans)' },
		{ value: 'Autre', label: 'Autre' },
	];
	
	writeValue(obj: string | null): void {
		this.value.set(obj);
	}

	registerOnChange(fn: (value: string | null) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.isDisabled.set(isDisabled);
	}

	onSelectChange(value: unknown): void {
		const v = (typeof value === 'string') ? value : (value as { target?: { value?: string } } | null)?.target?.value;
		const normalized = v || null;
		this.value.set(normalized);
		this.onChange(normalized);
		this.onTouched();
	}
}



