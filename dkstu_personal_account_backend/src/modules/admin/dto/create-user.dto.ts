import {
  IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString,
  MinLength, MaxLength, IsBoolean, Matches, ValidateIf,
} from 'class-validator';
import { Role } from '../../../auth/enums/role.enum';

const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @Matches(PHONE_E164_REGEX, {
    message: 'Телефон должен быть в формате E.164: +71234567890',
  })
  phone!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  // Номер зачётной книжки обязателен для студентов, для других ролей не нужен.
  @ValidateIf((o) => !o.role || o.role === Role.STUDENT)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  gradeBook?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;
}
