import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { GradeRecord } from './entities/grade-record.entity';
import { PortfolioItem } from './entities/portfolio-item.entity';
import { Scholarship } from './entities/scholarship.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GradeRecord, PortfolioItem, Scholarship, User])],
  providers: [StudentsService],
  controllers: [StudentsController],
  exports: [StudentsService],
})
export class StudentsModule {}
