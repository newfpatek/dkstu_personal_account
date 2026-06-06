import { IsString, IsOptional, IsUUID, IsNotEmpty, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}
