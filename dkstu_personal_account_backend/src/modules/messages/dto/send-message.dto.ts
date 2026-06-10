import { IsString, IsOptional, IsUUID, IsNotEmpty, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  // 5000 символов — достаточно для любого объявления; без ограничения можно хранить мегабайты
  @MaxLength(5000)
  text!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}
