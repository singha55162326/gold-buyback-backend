import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3, { message: 'ຊື່ຜູ້ໃຊ້ສັ້ນເກີນໄປ' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'ລະຫັດຜ່ານສັ້ນເກີນໄປ' })
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
