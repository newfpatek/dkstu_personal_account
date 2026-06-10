import { Matches, IsString, IsNotEmpty, MaxLength } from 'class-validator';

// E.164 — международный стандарт номеров телефонов (ITU-T E.164):
//   +  — обязательный префикс
//   [1-9] — первая цифра кода страны (не может быть 0)
//   \d{6,14} — оставшиеся цифры (всего 7–15 цифр без +)
// Примеры: +71234567890 (РФ), +380991234567 (UA), +8613912345678 (CN)
// Это предотвращает SQL-инъекции и мусорный ввод — только конкретный формат.
const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

export class LoginDto {
  @Matches(PHONE_E164_REGEX, {
    message: 'Телефон должен быть в формате E.164: +71234567890 (7–15 цифр после +)',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  // MaxLength защищает от передачи огромных строк на bcrypt.compare()
  @MaxLength(128)
  password!: string;
}