import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToClass } from 'class-transformer';

import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GhlService } from '../../shared/services/Ghl.service';
import { CreateUserInput } from '../../user/dtos/user-create-input.dto';
import { UserOutput } from '../../user/dtos/user-output.dto';
import { UserService } from '../../user/services/user.service';
import { ROLE } from '../constants/role.constant';
import { RegisterInput } from '../dtos/auth-register-input.dto';
import { RegisterOutput } from '../dtos/auth-register-output.dto';
import {
  AuthTokenOutput,
  UserAccessTokenClaims,
} from '../dtos/auth-token-output.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
    private readonly ghlService: GhlService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async validateUser(
    ctx: RequestContext,
    email: string,
    pass: string,
  ): Promise<UserAccessTokenClaims> {
    this.logger.log(ctx, `${this.validateUser.name} was called`);

    // The userService will throw Unauthorized in case of invalid email/password.
    const user = await this.userService.validateEmailPassword(ctx, email, pass);

    // Prevent disabled users from logging in.
    if (user.isAccountDisabled) {
      throw new UnauthorizedException('This user account has been disabled');
    }

    return user;
  }

  login(ctx: RequestContext): AuthTokenOutput {
    this.logger.log(ctx, `${this.login.name} was called`);
    return this.getAuthToken(ctx, ctx.user!);
  }

  async register(
    ctx: RequestContext,
    input: RegisterInput,
  ): Promise<RegisterOutput> {
    this.logger.log(ctx, `${this.register.name} was called`);
    this.logger.log(
      ctx,
      `DEBUG - AuthService received RegisterInput: ${JSON.stringify(input, null, 2)}`,
    );
    this.logger.log(
      ctx,
      `DEBUG - AuthService input.name: "${input.name}" (type: ${typeof input.name})`,
    );
    // TODO : Setting default role as USER here. Will add option to change this later via ADMIN users.
    // input.roles = [ROLE.USER];
    input.isAccountDisabled = false;
    this.logger.log(
      ctx,
      `DEBUG - After setting defaults, input.name: "${input.name}"`,
    );

    //also create user in GHL
    // const ghlUser = await this.ghlService.createUser(input);

    //also update the calendar to add the new user
    // await this.ghlService.addUserToCalendar(ghlUser);

    // Ensure name field is present
    this.logger.log(
      ctx,
      `DEBUG - Before name validation, input.name: "${input.name}"`,
    );
    console.log('RegisterInput:', input);
    if (!input.name) {
      this.logger.error(
        ctx,
        `DEBUG - Name field is missing! input.name: "${input.name}"`,
      );
      throw new Error('Name field is required for user registration');
    }

    // Create a proper CreateUserInput object to ensure all required fields are present
    const createUserInput: CreateUserInput = {
      name: input.name,
      phone: input.phone,
      username: input.username,
      password: input.password,
      roles: input.roles,
      email: input.email,
      isAccountDisabled: input.isAccountDisabled,
      ghlUserId: input.ghlUserId,
    };

    this.logger.log(
      ctx,
      `DEBUG - Created CreateUserInput: ${JSON.stringify(createUserInput, null, 2)}`,
    );
    this.logger.log(
      ctx,
      `DEBUG - CreateUserInput.name: "${createUserInput.name}" (type: ${typeof createUserInput.name})`,
    );
    console.log('CreateUserInput:', createUserInput);

    const registeredUser = await this.userService.createUser(
      ctx,
      createUserInput,
    );

    //assign order round robin to the user
    // await this.userService.assignOrderRoundRobin(ctx, registeredUser.id);

    return plainToClass(RegisterOutput, registeredUser, {
      excludeExtraneousValues: true,
    });
  }

  async refreshToken(ctx: RequestContext): Promise<AuthTokenOutput> {
    this.logger.log(ctx, `${this.refreshToken.name} was called`);

    const user = await this.userService.getUserById(ctx, ctx.user!.id);
    if (!user) {
      throw new UnauthorizedException('Invalid user id');
    }

    return this.getAuthToken(ctx, user);
  }

  getAuthToken(
    ctx: RequestContext,
    user: UserAccessTokenClaims | UserOutput,
  ): AuthTokenOutput {
    this.logger.log(ctx, `${this.getAuthToken.name} was called`);

    const subject = { sub: user.id };
    const payload = {
      username: user.username,
      sub: user.id,
      roles: user.roles,
    };

    const authToken = {
      refreshToken: this.jwtService.sign(subject, {
        expiresIn: this.configService.get('jwt.refreshTokenExpiresInSec'),
      }),
      accessToken: this.jwtService.sign(
        { ...payload, ...subject },
        { expiresIn: this.configService.get('jwt.accessTokenExpiresInSec') },
      ),
    };
    return plainToClass(AuthTokenOutput, authToken, {
      excludeExtraneousValues: true,
    });
  }
}
