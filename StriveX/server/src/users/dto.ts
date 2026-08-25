import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(2) username: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsBoolean() guest?: boolean;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
