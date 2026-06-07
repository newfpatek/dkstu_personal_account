import { IsUUID, IsInt, IsString, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateTeacherAssignmentDto {
  @IsUUID()
  teacherId!: string;

  @IsUUID()
  groupId!: string;

  @IsUUID()
  disciplineId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  semester!: number;

  @IsString()
  @IsNotEmpty()
  academicYear!: string;
}
