export interface AdminSafeDto {
  id: string;
  login: string;
  email: string | null;
}

export interface AdminSessionResponse {
  admin: AdminSafeDto;
}

export interface AdminLoginInput {
  login: string;
  password: string;
}
