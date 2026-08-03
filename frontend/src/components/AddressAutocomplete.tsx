import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  fetchAddressSuggestions,
  type AddressSuggestion,
} from "../api/addressAutocomplete";
import "./AddressAutocomplete.css";

type AddressAutocompleteProps = {
  id?: string;
  value: string;
  name?: string;
  required?: boolean;
  placeholder?: string;
  onValueChange: (value: string) => void;
  onSelect: (
    suggestion: AddressSuggestion,
  ) => void;
};

export function AddressAutocomplete({
  id,
  value,
  name,
  required = false,
  placeholder = "Start typing an address",
  onValueChange,
  onSelect,
}: AddressAutocompleteProps) {
  const listId = useId();
  const selectedValue = useRef<string | null>(
    null,
  );
  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const [suggestions, setSuggestions] =
    useState<AddressSuggestion[]>([]);
  const [loading, setLoading] =
    useState(false);
  const [open, setOpen] =
    useState(false);
  const [searchEnabled, setSearchEnabled] =
    useState(false);

  useEffect(() => {
    const query = value.trim();

    if (selectedValue.current === query) {
      selectedValue.current = null;
      return;
    }

    if (!searchEnabled) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    if (query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      setLoading(true);

      void fetchAddressSuggestions(
        query,
        controller.signal,
      )
        .then((results) => {
          setSuggestions(results);
          setOpen(results.length > 0);
        })
        .catch((error: unknown) => {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            return;
          }

          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchEnabled, value]);

  function chooseSuggestion(
    suggestion: AddressSuggestion,
  ): void {
    selectedValue.current =
      suggestion.addressLine1.trim();

    setSearchEnabled(false);
    setSuggestions([]);
    setOpen(false);

    onValueChange(
      suggestion.addressLine1,
    );
    onSelect(suggestion);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="address-autocomplete">
      <div className="address-autocomplete-input">
        <input
          ref={inputRef}
          id={id}
          aria-autocomplete="list"
          aria-busy={loading}
          aria-controls={listId}
          aria-expanded={open}
          autoComplete="off"
          className="input"
          name={name}
          placeholder={placeholder}
          required={required}
          type="text"
          value={value}
          onChange={(event) => {
            selectedValue.current = null;
            setSearchEnabled(true);
            onValueChange(event.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(
              () => setOpen(false),
              120,
            );
          }}
          onKeyDown={handleKeyDown}
        />

        {value.length > 0 && (
          <button
            aria-label="Clear address"
            className="address-autocomplete-clear"
            title="Clear address"
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              selectedValue.current = null;
              setSearchEnabled(false);
              setSuggestions([]);
              setOpen(false);
              setLoading(false);
              onValueChange("");

              window.requestAnimationFrame(
                () => inputRef.current?.focus(),
              );
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      {loading && (
        <span className="address-autocomplete-status">
          Searching
        </span>
      )}

      {open && suggestions.length > 0 && (
        <div
          className="address-autocomplete-menu"
          id={listId}
          role="listbox"
        >
          {suggestions.map(
            (suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                role="option"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() =>
                  chooseSuggestion(suggestion)
                }
              >
                <strong>
                  {suggestion.addressLine1}
                </strong>

                <span>
                  {[
                    suggestion.city,
                    suggestion.state,
                    suggestion.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
