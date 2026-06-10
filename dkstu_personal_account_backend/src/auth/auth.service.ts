import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/users/entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // --- ЛОГИН ---
  async login(dto: LoginDto) {
    // Ищем пользователя по номеру телефона — основной идентификатор для входа
    const user = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });

    // Одинаковое сообщение для «не найден» и «неверный пароль» — намеренно:
    // разные сообщения дают злоумышленнику подсказку о существовании аккаунта (user enumeration).
    if (!user) {
      throw new UnauthorizedException('Неверный номер телефона или пароль');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный номер телефона или пароль');
    }

    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    // Создаём токен
    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,      // может быть null
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}