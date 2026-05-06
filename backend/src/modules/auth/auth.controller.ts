import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AccessTokenService } from '../operacao/services/access-token.service';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private accessTokenService: AccessTokenService,
  ) {}

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  login(@Request() req: any) {
    return this.authService.login(req.user as any);
  }

  /**
   * POST /api/auth/token-exchange
   * Validates an opaque access token and returns a short-lived JWT.
   */
  @Public()
  @Post('token-exchange')
  async tokenExchange(@Body() body: { token: string }) {
    if (!body?.token) {
      throw new UnauthorizedException('token is required');
    }
    const accessToken = await this.accessTokenService.validateToken(body.token);
    if (!accessToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const { passwordHash: _ph, ...user } = accessToken.user as any;
    return this.authService.login(user);
  }

  @Get('me')
  me(@Request() req: any) {
    const { passwordHash: _passwordHash, ...user } = req.user;
    return user;
  }
}
