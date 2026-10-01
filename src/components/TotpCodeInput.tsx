import { inputClass, labelClass } from './formStyles';

type TotpCodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

// Champ du code à 6 chiffres de l'application d'authentification.
export function TotpCodeInput({ id, value, onChange, autoFocus = false }: TotpCodeInputProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Code à 6 chiffres
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123 456"
        required
        autoFocus={autoFocus}
        value={value}
        // Seuls les chiffres sont gardés, tronqués à 6 (un collage "123 456" ou "123-456" reste valide)
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        className={`${inputClass} text-center font-mono text-lg tracking-widest`}
      />
    </div>
  );
}
