import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersRepository {
  list(): string {
    return 'Hello World!';
  }
}
