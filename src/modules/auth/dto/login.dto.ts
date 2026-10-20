import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Sign-in carries no format rules beyond "not empty".
 *
 * A minimum length here is a rule about how accounts are CREATED, and
 * enforcing it at sign-in locks out any account that predates the rule or
 * was made another way. That is not hypothetical: the seeded Financial
 * Controller is `fc`, two characters, and a MinLength(3) here meant that
 * account could never sign in at all — the UI reported "ຊື່ຜູ້ໃຊ້ສັ້ນເກີນໄປ"
 * for a username the system had issued itself.
 *
 * The length rule still applies where it belongs, on CreateUserDto.
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'ກະລຸນາປ້ອນລະຫັດຜ່ານ' })
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
