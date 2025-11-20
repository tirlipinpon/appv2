import { Component, Input, forwardRef } from '@angular/core';

import { CommonModule } from '@angular/common';

import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';



@Component({

  selector: 'app-form-field',

  standalone: true,

  imports: [CommonModule, FormsModule, ReactiveFormsModule],

  templateUrl: './form-field.component.html',

  styleUrl: './form-field.component.scss',

  providers: [

    {

      provide: NG_VALUE_ACCESSOR,

      useExisting: forwardRef(() => FormFieldComponent),

      multi: true

    }

  ]

})

export class FormFieldComponent implements ControlValueAccessor {

  @Input() label = '';

  @Input() type = 'text';

  @Input() placeholder = '';

  @Input() required = false;

  @Input() disabled = false;

  @Input() errorMessage = '';

  @Input() hint = '';

  @Input() control?: FormControl;

  value: string = '';
  
  touched: boolean = false;

  private onChange = (_value: string): void => {
    // Set by registerOnChange
  };

  private onTouched = (): void => {
    // Set by registerOnTouched
  };



  writeValue(value: string): void {

    this.value = value || '';

  }



  registerOnChange(fn: (value: string) => void): void {

    this.onChange = fn;

  }



  registerOnTouched(fn: () => void): void {

    this.onTouched = fn;

  }



  setDisabledState(isDisabled: boolean): void {

    this.disabled = isDisabled;

  }



  onInput(event: Event): void {

    const value = (event.target as HTMLInputElement).value;

    this.value = value;

    this.onChange(value);

  }



  onBlur(): void {

    this.touched = true;

    this.onTouched();

  }



  get isInvalid(): boolean {

    if (this.control) {

      return this.control.invalid && (this.control.touched || this.touched);

    }

    return false;

  }



  get showError(): boolean {

    return this.isInvalid && !!this.errorMessage;

  }

}

