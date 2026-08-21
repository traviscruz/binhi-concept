export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  isValid: boolean;
}

export function validatePassword(password: string): PasswordRequirements {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return {
    minLength,
    hasUppercase,
    hasNumber,
    isValid: minLength && hasUppercase && hasNumber,
  };
}
