import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ScholarshipType } from '../../students/enums/scholarship-type.enum';

export class SetBaseAmountDto {
  @IsEnum(ScholarshipType)
  type!: ScholarshipType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  direction?: string | null;
}
