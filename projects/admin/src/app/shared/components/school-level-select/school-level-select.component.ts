import { Component, Input, forwardRef, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { getSchoolLevelsForSelect } from '../../../features/teacher/utils/school-levels.util';

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
		...getSchoolLevelsForSelect(),
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



