import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ScholarshipType } from '../../students/enums/scholarship-type.enum';
import { EnhancedDirection } from '../../students/enums/enhanced-direction.enum';

export class AssignScholarshipDto {
  @IsEnum(ScholarshipType)
  type!: ScholarshipType;

  @IsEnum(EnhancedDirection)
  @IsOptional()
  direction?: EnhancedDirection;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  @IsOptional()
  periodEnd?: string;
}
