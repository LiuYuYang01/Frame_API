export class LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    username: string;
    create_time: Date;
  };
}
