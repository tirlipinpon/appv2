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
	// Format d'option affichée par le select
	private static mapToOption(year: SchoolYear): { id: string; label: string } {
		return { id: year.id, label: year.label };
	}

	@Input() label = 'Année scolaire';
	@Input() required = false;
	@Input() disabled = false;
	schoolId = input<string | null | undefined>(undefined);
	@Input() id: string | undefined;
	// Option: on peut fournir directement les années depuis le parent
	private readonly useExternalYears = signal<boolean>(false);
	@Input() set items(value: { id: string; label: string }[] | null) {
		this.useExternalYears.set(!!value && value.length > 0);
		this.years.set(value ?? []);
	}

	private readonly schoolYearService = inject(SchoolYearService);

	private onChange: (value: string | null) => void = () => undefined;
	private onTouched: () => void = () => undefined;
	private subscription: Subscription | null = null;
	private readonly autoId = `school-year-${Math.random().toString(36).slice(2)}`;

	readonly years = signal<{ id: string; label: string }[]>([]);
	readonly isDisabled = signal<boolean>(false);
	readonly value = signal<string | null>(null);

	readonly isSelectDisabled = computed(() => this.disabled || this.isDisabled() || (!this.useExternalYears() && !this.schoolId()));
	readonly selectId = computed(() => this.id ?? this.autoId);
	readonly displayYears = computed<{ id: string; label: string }[]>(() => this.years());

	ngOnInit(): void {
		effect(() => {
			// Si des années sont fournies par le parent, ne pas charger via service
			if (this.useExternalYears()) return;
			const currentSchool = this.schoolId() || null;
			if (currentSchool) {
				this.loadYears(currentSchool);
			} else {
				this.years.set([]);
				this.writeValue(null);
			}
		}, { allowSignalWrites: true });
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
			this.years.set((schoolYears || []).map(SchoolYearSelectComponent.mapToOption));
		});
	}
}


