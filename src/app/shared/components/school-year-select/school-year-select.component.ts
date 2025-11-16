import { Component, OnDestroy, OnInit, forwardRef, inject, signal, computed, effect, input, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { SchoolYearService, SchoolYear } from '../../services/school-year.service';
import { Subscription } from 'rxjs';

@Component({
	selector: 'app-school-year-select',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule],
	templateUrl: './school-year-select.component.html',
	styleUrl: './school-year-select.component.scss',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => SchoolYearSelectComponent),
			multi: true,
		},
	],
})
export class SchoolYearSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
	@Input() label = 'Année scolaire';
	@Input() required = false;
	@Input() disabled = false;
	schoolId = input<string | null | undefined>(undefined);
	@Input() id: string | undefined;

	private readonly schoolYearService = inject(SchoolYearService);

	private onChange: (value: string | null) => void = () => {};
	private onTouched: () => void = () => {};
	private subscription: Subscription | null = null;
	private readonly autoId = `school-year-${Math.random().toString(36).slice(2)}`;

	readonly years = signal<SchoolYear[]>([]);
	readonly isDisabled = signal<boolean>(false);
	readonly value = signal<string | null>(null);

	readonly isSelectDisabled = computed(() => this.disabled || this.isDisabled() || !this.schoolId());
	readonly selectId = computed(() => this.id ?? this.autoId);

	ngOnInit(): void {
		effect(() => {
			const currentSchool = this.schoolId() || null;
			if (currentSchool) {
				this.loadYears(currentSchool);
			} else {
				this.years.set([]);
				this.writeValue(null);
			}
		});
	}

	ngOnDestroy(): void {
		this.subscription?.unsubscribe();
	}

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

	private loadYears(schoolId: string): void {
		this.subscription?.unsubscribe();
		this.subscription = this.schoolYearService.getSchoolYearsBySchool(schoolId).subscribe(({ schoolYears }) => {
			this.years.set(schoolYears);
		});
	}
}


