import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SetGroupRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;
}
