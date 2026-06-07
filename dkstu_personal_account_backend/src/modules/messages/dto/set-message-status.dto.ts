import { IsBoolean } from 'class-validator';

export class SetMessageStatusDto {
  @IsBoolean()
  isRelevant!: boolean;
}
