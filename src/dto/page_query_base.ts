import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PageQueryBaseDto {
  @ApiProperty({
    description: '页码',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return 1;
    }
    const num = Number(value);
    return isNaN(num) ? 1 : num;
  })
  @Type(() => Number)
  @IsNumber({}, { message: '页码必须是数字' })
  @Min(1, { message: '页码必须大于等于1' })
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return 10;
    }
    const num = Number(value);
    return isNaN(num) ? 10 : num;
  })
  @Type(() => Number)
  @IsNumber({}, { message: '每页数量必须是数字' })
  @Min(1, { message: '每页数量必须大于等于1' })
  limit?: number = 10;
}
