import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(2000)
  year!: number;
}
