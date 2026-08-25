import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateResultDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() session_id: string;
  @IsString() station_id: string;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsIn(['completed', 'failed', 'abandoned', 'timeout']) status?: string;
  @IsOptional() @IsInt() duration_ms?: number;
  @IsOptional() @IsObject() meta?: Record<string, unknown>;
}
