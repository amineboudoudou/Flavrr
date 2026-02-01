/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export interface AddressComponents {
    street: string;
    city: string;
    region: string;
    postal_code: string;
    country: string;
    lat: number;
    lng: number;
    place_id?: string;
    formatted_address?: string;
}

interface Props {
    onAddressSelect: (address: AddressComponents) => void;
    placeholder?: string;
    className?: string;
    /** Optional controlled value for the input */
    value?: string;
    /** Notify parent when the raw input text changes */
    onValueChange?: (value: string) => void;
    /** Restrict suggestions to specific countries (ISO codes) */
    restrictCountries?: string[];
}

export const AddressAutocomplete: React.FC<Props> = ({
    onAddressSelect,
    placeholder,
    className,
    value,
    onValueChange,
    restrictCountries,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [internalValue, setInternalValue] = useState('');
    const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
    const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
    const placesLibrary = useMapsLibrary('places');

    useEffect(() => {
        if (typeof value === 'string' && value !== internalValue) {
            setInternalValue(value);
        }
    }, [value]);

    useEffect(() => {
        if (!placesLibrary) return;

        autocompleteServiceRef.current = new placesLibrary.AutocompleteService();
        placesServiceRef.current = new placesLibrary.PlacesService(document.createElement('div'));
    }, [placesLibrary]);

    const fetchPlaceDetails = (placeId: string) => {
        if (!placesServiceRef.current) return;

        placesServiceRef.current.getDetails(
            {
                placeId,
                fields: ['address_components', 'geometry', 'formatted_address'],
            },
            (place, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !place || !place.geometry || !place.geometry.location) {
                    console.error('Failed to fetch place details:', status);
                    return;
                }

                const components = place.address_components || [];
                let street_number = '';
                let route = '';
                let city = '';
                let region = '';
                let postal_code = '';
                let country = '';

                for (const component of components) {
                    if (!component.types || component.types.length === 0) continue;
                    switch (component.types[0]) {
                        case 'street_number':
                            street_number = component.long_name;
                            break;
                        case 'route':
                            route = component.long_name;
                            break;
                        case 'locality':
                        case 'postal_town':
                            city = component.long_name;
                            break;
                        case 'administrative_area_level_1':
                            region = component.short_name;
                            break;
                        case 'postal_code':
                            postal_code = component.long_name;
                            break;
                        case 'country':
                            country = component.short_name;
                            break;
                    }
                }

                const payload: AddressComponents = {
                    street: `${street_number} ${route}`.trim(),
                    city,
                    region,
                    postal_code,
                    country,
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    place_id: place.place_id || undefined,
                    formatted_address: place.formatted_address || undefined,
                };

                onAddressSelect(payload);
                const formatted = payload.formatted_address || payload.street;
                setInternalValue(formatted);
                onValueChange?.(formatted);
                setSuggestions([]);
                setShowSuggestions(false);
            }
        );
    };

    const fetchPredictions = (input: string) => {
        if (!autocompleteServiceRef.current || !input) {
            setSuggestions([]);
            return;
        }

        autocompleteServiceRef.current.getPlacePredictions(
            {
                input,
                types: ['address'],
                componentRestrictions:
                    restrictCountries && restrictCountries.length > 0
                        ? { country: restrictCountries }
                        : undefined,
            },
            (predictions, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                    setSuggestions([]);
                    return;
                }
                setSuggestions(predictions);
                setShowSuggestions(true);
            }
        );
    };

    const handleSuggestionClick = (prediction: google.maps.places.AutocompletePrediction) => {
        fetchPlaceDetails(prediction.place_id);
        setInternalValue(prediction.description);
        onValueChange?.(prediction.description);
    };

    return (
        <>
            <input
                ref={inputRef}
                type="text"
                value={value ?? internalValue}
                onChange={(e) => {
                    const val = e.target.value;
                    setInternalValue(val);
                    onValueChange?.(val);
                    fetchPredictions(val);
                }}
                onFocus={() => {
                    if (suggestions.length > 0) {
                        setShowSuggestions(true);
                    }
                }}
                placeholder={placeholder || 'Start typing your address...'}
                className={className}
            />
            {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 bg-neutral-900 border border-white/10 rounded-lg max-h-60 overflow-y-auto shadow-xl">
                    {suggestions.map((prediction) => (
                        <button
                            key={prediction.place_id}
                            type="button"
                            onClick={() => handleSuggestionClick(prediction)}
                            className="w-full text-left px-4 py-2 hover:bg-white/5 text-white/80 border-b border-white/5 last:border-b-0"
                        >
                            <span className="block text-sm font-medium text-white">{prediction.structured_formatting.main_text}</span>
                            <span className="block text-xs text-white/50">{prediction.structured_formatting.secondary_text}</span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};
