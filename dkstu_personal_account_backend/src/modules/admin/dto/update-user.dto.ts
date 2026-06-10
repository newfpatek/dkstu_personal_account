import {
  IsEmail, IsEnum, IsOptional, IsString,
  MinLength, MaxLength, IsBoolean, Matches,
} from 'class-validator';
import { Role } from '../../../auth/enums/role.enum';

const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  // Можно сменить телефон (=логин) пользователя через редактирование.
  @Matches(PHONE_E164_REGEX, {
    message: 'Телефон должен быть в формате E.164: +71234567890',
  })
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
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
