import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { EnhancedDirection } from '../../students/enums/enhanced-direction.enum';

export class UpdateScholarshipDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsEnum(EnhancedDirection)
  @IsOptional()
  direction?: EnhancedDirection;

  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
