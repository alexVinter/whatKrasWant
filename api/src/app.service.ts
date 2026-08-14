import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot(): string {
    return 'Чего хочет Красноярск? API — development environment is running';
  }
}
