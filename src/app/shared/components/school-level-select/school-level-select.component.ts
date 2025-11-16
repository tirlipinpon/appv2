import { Component, Input, forwardRef, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

interface SchoolLevelOption { value: string; label: string }

@Component({
	selector: 'app-school-level-select',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule],
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
		{ value: '1ère', label: '1ère' },
		{ value: '2ème', label: '2ème' },
		{ value: '3ème', label: '3ème' },
		{ value: '4ème', label: '4ème' },
		{ value: '5ème', label: '5ème' },
		{ value: '6ème', label: '6ème' },
		{ value: 'autre', label: 'Autre' },
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

	onSelectChange(value: string): void {
		const normalized = value || null;
		this.value.set(normalized);
		this.onChange(normalized);
		this.onTouched();
	}
}



