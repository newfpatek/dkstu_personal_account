import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Получаем роли, которые прописаны в декораторе @Roles(...)
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());

    // Если декоратор не стоит — роут открыт для всех авторизованных
    if (!requiredRoles) return true;

    // Достаём пользователя из request (его туда положил JwtStrategy)
    const { user } = context.switchToHttp().getRequest();

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return true;
  }
}