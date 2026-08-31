import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VK_USER_INFO_URL } from './public-auth.constants';

export interface VkVerifiedProfile {
  vkId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface VkUserInfoResponse {
  user?: {
    user_id?: string | number;
    first_name?: string;
    last_name?: string;
    avatar?: string;
    photo_200?: string;
  };
  error?: string;
  error_description?: string;
}

@Injectable()
export class VkIdClient {
  constructor(private readonly config: ConfigService) {}

  async fetchUserProfile(accessToken: string): Promise<VkVerifiedProfile> {
    const clientId = this.config.get<string>('VK_CLIENT_ID');
    if (!clientId) {
      throw new Error('VK_CLIENT_ID is not configured');
    }

    const response = await fetch(VK_USER_INFO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        access_token: accessToken,
      }),
    });

    let payload: VkUserInfoResponse;
    try {
      payload = (await response.json()) as VkUserInfoResponse;
    } catch {
      throw new UnauthorizedException('Invalid VK access token');
    }

    if (!response.ok || payload.error || !payload.user?.user_id) {
      throw new UnauthorizedException('Invalid VK access token');
    }

    const firstName = payload.user.first_name?.trim();
    const lastName = payload.user.last_name?.trim();
    if (!firstName || !lastName) {
      throw new UnauthorizedException('Incomplete VK profile');
    }

    const avatarUrl =
      payload.user.avatar?.trim() ||
      payload.user.photo_200?.trim() ||
      null;

    return {
      vkId: String(payload.user.user_id),
      firstName,
      lastName,
      avatarUrl,
    };
  }
}
