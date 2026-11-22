"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import {
  formatVietnameseNumber,
  normalizeNumericText,
  numericText,
  numericValidation,
  parseVietnameseCurrencyPaste,
} from "@/lib/numeric-input";

export type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "type"
> & {
  value?: string | number | null;
  defaultValue?: string | number | null;
  type?: "number";
  currency?: boolean;
  error?: string;
  onValueChange?: (value: string) => void;
};
/** The editable draft is text. Only validated submission code converts it to a number. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      onFocus,
      onBlur,
      onPaste,
      onMouseUp,
      name,
      currency = false,
      error,
      min,
      max,
      step = "1",
      required,
      disabled,
      type: _type,
      ...props
    },
    forwardedRef,
  ) {
    const [uncontrolled, setUncontrolled] = useState(() =>
      numericText(defaultValue),
    );
    const [focused, setFocused] = useState(false);
    const [touched, setTouched] = useState(false);
    const errorId = useId();
    void _type;
    const input = useRef<HTMLInputElement | null>(null);
    const raw = value !== undefined ? numericText(value) : uncontrolled;
    const decimal = step === "any" || !Number.isInteger(Number(step));
    const allowNegative = min !== undefined && Number(min) < 0;
    const validation =
      error || numericValidation(raw, { required, min, max, step });
    const setRef = useCallback(
      (node: HTMLInputElement | null) => {
        input.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );
    useEffect(() => {
      input.current?.setCustomValidity(disabled ? "" : validation);
    }, [validation, disabled]);
    useEffect(() => {
      const form = input.current?.form;
      if (!form || value !== undefined) return;
      const reset = (event: Event) => {
        queueMicrotask(() => {
          if (!event.defaultPrevented) {
            setUncontrolled(numericText(defaultValue));
            setTouched(false);
          }
        });
      };
      form.addEventListener("reset", reset);
      return () => form.removeEventListener("reset", reset);
    }, [value, defaultValue]);
    function emit(event: ChangeEvent<HTMLInputElement>, next: string) {
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
      onChange?.({
        ...event,
        target: {
          ...event.target,
          value: next,
          name: name ?? "",
          type: "text",
        },
        currentTarget: {
          ...event.currentTarget,
          value: next,
          name: name ?? "",
          type: "text",
        },
      } as ChangeEvent<HTMLInputElement>);
    }
    function accept(next: string) {
      return (
        decimal
          ? allowNegative
            ? /^-?\d*(?:\.\d*)?$/
            : /^\d*(?:\.\d*)?$/
          : allowNegative
            ? /^-?\d*$/
            : /^\d*$/
      ).test(next);
    }
    return (
      <>
        <input
          {...props}
          ref={setRef}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          aria-describedby={
            [
              props["aria-describedby"],
              touched && validation ? errorId : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={
            props["aria-invalid"] ?? (!!error || (touched && !!validation))
          }
          required={required}
          disabled={disabled}
          value={
            currency && !focused && !validation
              ? formatVietnameseNumber(raw)
              : raw
          }
          onChange={(event) => {
            const entered = event.target.value;
            const next = decimal ? entered.replace(",", ".") : entered;
            if (accept(next)) {
              const node = event.currentTarget,
                cursor = node.selectionStart;
              emit(event, next);
              if (next !== entered && cursor !== null)
                requestAnimationFrame(() =>
                  node.setSelectionRange(cursor, cursor),
                );
            }
          }}
          onFocus={(event) => {
            const node = event.currentTarget;
            const position = node.selectionStart ?? raw.length;
            const cursor = currency
              ? node.value
                  .slice(0, position)
                  .replaceAll(".", "")
                  .replace(",", ".").length
              : position;
            setFocused(true);
            if (/^0+(?:\.0*)?$/.test(raw)) node.select();
            else if (currency)
              requestAnimationFrame(() => {
                if (document.activeElement === node)
                  node.setSelectionRange(cursor, cursor);
              });
            onFocus?.(event);
          }}
          onMouseUp={(event) => {
            if (/^0+(?:\.0*)?$/.test(raw)) event.preventDefault();
            onMouseUp?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            setTouched(true);
            if (raw && !validation) {
              const next = normalizeNumericText(raw);
              if (next !== raw)
                emit(event as unknown as ChangeEvent<HTMLInputElement>, next);
            }
            onBlur?.(event);
          }}
          onPaste={(event) => {
            onPaste?.(event);
            if (event.defaultPrevented) return;
            const text = event.clipboardData.getData("text");
            const pasted = currency
              ? parseVietnameseCurrencyPaste(text)
              : decimal
                ? text.trim().replace(",", ".")
                : text.trim();
            if (pasted === undefined || !accept(pasted)) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            const node = event.currentTarget;
            const start = node.selectionStart ?? 0;
            const next =
              raw.slice(0, start) +
              pasted +
              raw.slice(node.selectionEnd ?? raw.length);
            if (accept(next)) {
              emit(event as unknown as ChangeEvent<HTMLInputElement>, next);
              requestAnimationFrame(() => {
                const cursor = start + pasted.length;
                node.setSelectionRange(cursor, cursor);
              });
            }
          }}
        />
        {name && (
          <input
            type="hidden"
            name={name}
            disabled={disabled}
            value={raw && !validation ? normalizeNumericText(raw) : raw}
          />
        )}
        {touched && validation && (
          <span
            id={errorId}
            className="mt-1 block text-xs text-danger"
            role="alert"
          >
            {validation}
          </span>
        )}
      </>
    );
  },
);
export const CurrencyInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function CurrencyInput(props, ref) {
    return <NumberInput step="0.01" min={0} {...props} currency ref={ref} />;
  },
);
export const IntegerInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function IntegerInput(props, ref) {
    return <NumberInput step="1" {...props} ref={ref} />;
  },
);
export const DecimalInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function DecimalInput(props, ref) {
    return <NumberInput step="any" {...props} ref={ref} />;
  },
);

/** Adapter for existing fields whose HTML type is selected at runtime. */
export function FormInput({
  numericKind = "integer",
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  numericKind?: "integer" | "decimal" | "currency";
}) {
  if (type !== "number") return <input type={type} {...props} />;
  const Component =
    numericKind === "currency"
      ? CurrencyInput
      : numericKind === "decimal"
        ? DecimalInput
        : IntegerInput;
  const { value, defaultValue, ...rest } = props;
  return (
    <Component
      {...rest}
      value={
        typeof value === "string" || typeof value === "number"
          ? value
          : undefined
      }
      defaultValue={
        typeof defaultValue === "string" || typeof defaultValue === "number"
          ? defaultValue
          : undefined
      }
    />
  );
}
