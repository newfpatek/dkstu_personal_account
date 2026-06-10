import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { PortfolioCategory } from './enums/portfolio-category.enum';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // ── Student: profile & group ─────────────────────────────────────────────

  @Get('me/profile')
  getMyProfile(@Request() req) {
    return this.studentsService.getProfile(req.user.id);
  }

  @Roles(Role.STUDENT)
  @Get('me/group')
  getMyGroup(@Request() req) {
    return this.studentsService.getMyGroup(req.user.id);
  }

  // ── Student: grades ──────────────────────────────────────────────────────

  @Roles(Role.STUDENT)
  @Get('me/grades/current')
  getMyCurrentSemesterPlan(
    @Request() req,
    @Query('semester') semester?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.studentsService.getCurrentSemesterPlan(
      req.user.id,
      semester ? parseInt(semester, 10) : undefined,
      academicYear,
    );
  }

  @Roles(Role.STUDENT)
  @Get('me/grades/all')
  getAllGrades(@Request() req) {
    return this.studentsService.getLatestGradesPerDiscipline(req.user.id);
  }

  @Roles(Role.STUDENT)
  @Get('me/grades')
  getMyGrades(
    @Request() req,
    @Query('semester') semester?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.studentsService.getGrades(
      req.user.id,
      semester ? parseInt(semester, 10) : undefined,
      academicYear,
    );
  }

  @Roles(Role.STUDENT)
  @Get('me/grades/history')
  getMyGradesHistory(@Request() req) {
    return this.studentsService.getGradesHistory(req.user.id);
  }

  @Roles(Role.STUDENT)
  @Get('me/gpa')
  async getMyGpa(@Request() req) {
    const gpa = await this.studentsService.calculateGpa(req.user.id);
    return { gpa };
  }

  @Roles(Role.STUDENT)
  @Get('me/debts')
  getMyDebts(@Request() req) {
    return this.studentsService.getDebts(req.user.id);
  }

  // ── Student: scholarship ─────────────────────────────────────────────────

  @Roles(Role.STUDENT)
  @Get('me/scholarship')
  getMyScholarship(@Request() req) {
    return this.studentsService.getScholarship(req.user.id);
  }

  // ── Student: portfolio ───────────────────────────────────────────────────

  @Roles(Role.STUDENT)
  @Get('me/portfolio/:id/file')
  serveMyPortfolioFile(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('inline') inline?: string,
  ) {
    return this.studentsService.servePortfolioFile(req.user.id, id, res, inline === 'true');
  }

  @Roles(Role.STUDENT)
  @Get('me/portfolio')
  getMyPortfolio(
    @Request() req,
    @Query('category') category?: PortfolioCategory,
  ) {
    return this.studentsService.getPortfolio(req.user.id, category);
  }

  @Roles(Role.STUDENT)
  @Post('me/portfolio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, _file, cb) => {
          const dir = path.join(
            process.cwd(),
            'uploads',
            'portfolio',
            req.user.id,
          );
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedMimes = new Set([
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.oasis.opendocument.text',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.oasis.opendocument.spreadsheet',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/zip',
          'application/x-rar-compressed',
          'application/vnd.rar',
        ]);
        const allowedExts = new Set([
          '.pdf', '.doc', '.docx', '.odt',
          '.xls', '.xlsx', '.ods',
          '.jpg', '.jpeg', '.png', '.gif', '.webp',
          '.zip', '.rar',
        ]);
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedMimes.has(file.mimetype) && allowedExts.has(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Недопустимый тип файла. Разрешены: PDF, DOC/DOCX, ODT, XLS/XLSX, ODS, изображения (JPG/PNG/GIF/WEBP), ZIP, RAR'), false);
        }
      },
    }),
  )
  addPortfolioItem(
    @Request() req,
    @Body() body: { title: string; category: PortfolioCategory; description?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.studentsService.addPortfolioItem(req.user.id, body, file);
  }

  @Roles(Role.STUDENT)
  @Delete('me/portfolio/:id')
  deletePortfolioItem(@Request() req, @Param('id') id: string) {
    return this.studentsService.deletePortfolioItem(req.user.id, id);
  }

  // ── Staff / Admin / Teacher: search & view any student ──────────────────

  @Roles(Role.STAFF, Role.ADMIN, Role.TEACHER)
  @Get()
  searchStudents(
    @Query('q') q?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.studentsService.searchStudents(q, groupId);
  }

  @Roles(Role.STAFF, Role.ADMIN, Role.TEACHER)
  @Get(':id/profile')
  getStudentProfile(@Param('id') id: string) {
    return this.studentsService.getStudentProfileById(id);
  }

  @Roles(Role.STAFF, Role.ADMIN, Role.TEACHER)
  @Get(':id/grades/all')
  getStudentAllGrades(@Param('id') id: string) {
    return this.studentsService.getLatestGradesPerDiscipline(id);
  }

  @Roles(Role.STAFF, Role.ADMIN, Role.TEACHER)
  @Get(':id/grades')
  getStudentGrades(
    @Param('id') id: string,
    @Query('semester') semester?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.studentsService.getGrades(
      id,
      semester ? parseInt(semester, 10) : undefined,
      academicYear,
    );
  }

  @Roles(Role.STAFF, Role.ADMIN, Role.TEACHER)
  @Get(':id/scholarship')
  getStudentScholarship(@Param('id') id: string) {
    return this.studentsService.getScholarship(id);
  }

  @Roles(Role.STAFF, Role.ADMIN, Role.TEACHER)
  @Get(':studentId/portfolio/:itemId/file')
  serveStudentPortfolioFile(
    @Param('studentId') studentId: string,
    @Param('itemId') itemId: string,
    @Res() res: Response,
    @Query('inline') inline?: string,
  ) {
    return this.studentsService.servePortfolioFile(studentId, itemId, res, inline === 'true');
  }

  @Roles(Role.STAFF, Role.ADMIN, Role.TEACHER)
  @Get(':id/portfolio')
  getStudentPortfolio(
    @Param('id') id: string,
    @Query('category') category?: PortfolioCategory,
  ) {
    return this.studentsService.getPortfolio(id, category);
  }
}
