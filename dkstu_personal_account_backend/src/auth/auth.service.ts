import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // --- РЕГИСТРАЦИЯ ---
  async register(dto: RegisterDto) {
    // Проверяем, не занят ли email
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // Хэшируем пароль
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Создаём пользователя в БД
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      // role: 'student' — роль по умолчанию из /modules/users/entities/user.entity.ts
    });

    await this.userRepository.save(user);

    return { message: 'Регистрация прошла успешно' };
  }

  // --- ЛОГИН ---
  async login(dto: LoginDto) {
    // Ищем пользователя по email
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    // Сравниваем пароль с хэшем в БД
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    // Формируем payload — данные, которые "зашьём" в токен
    const payload = {
      sub: user.id,       // sub — стандартное поле JWT (subject = кто это)
      email: user.email,
      role: user.role,
    };

    // Создаём токен
    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}