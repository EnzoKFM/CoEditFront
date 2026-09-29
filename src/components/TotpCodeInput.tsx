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
        maxLength={7}
        placeholder="123 456"
        required
        autoFocus={autoFocus}
        value={value}
        // Seuls les chiffres et les espaces sont gardés (l'API accepte "123 456")
        onChange={(event) => onChange(event.target.value.replace(/[^\d ]/g, ''))}
        className={`${inputClass} text-center font-mono text-lg tracking-widest`}
      />
    </div>
  );
}
