import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdeaStatus, Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  hashVoteFingerprint,
  normalizeClientIp,
} from '../../common/vote-fraud/vote-fraud-hash.util';
import { SettingsService } from '../settings/settings.service';

export interface CastVoteResult {
  voteId: string;
  voteCount: number;
  hasVoted: true;
}

@Injectable()
export class PublicVoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  async castVote(
    slug: string,
    user: User,
    requestMeta: {
      forwardedFor?: string | string[];
      remoteAddress?: string;
      userAgent?: string;
    },
  ): Promise<CastVoteResult> {
    await this.assertVotingEnabled();

    if (user.isBlocked) {
      throw new ForbiddenException('User is blocked');
    }

    const idea = await this.prisma.idea.findUnique({ where: { slug } });
    if (!idea) {
      throw new NotFoundException('Initiative not found');
    }
    if (idea.status !== IdeaStatus.PUBLISHED) {
      throw new NotFoundException('Initiative not found');
    }

    const existing = await this.prisma.vote.findUnique({
      where: { ideaId_userId: { ideaId: idea.id, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException('Already voted');
    }

    const secret = this.requireFraudHashSecret();
    const ip = normalizeClientIp(
      requestMeta.forwardedFor,
      requestMeta.remoteAddress,
    );
    const ipHash = hashVoteFingerprint(secret, ip);
    const userAgentHash = hashVoteFingerprint(secret, requestMeta.userAgent);

    try {
      const vote = await this.prisma.vote.create({
        data: {
          ideaId: idea.id,
          userId: user.id,
          ipHash,
          userAgentHash,
        },
      });

      const voteCount = await this.countValidVotes(idea.id);
      return { voteId: vote.id, voteCount, hasVoted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Already voted');
      }
      throw error;
    }
  }

  async countValidVotes(ideaId: string): Promise<number> {
    return this.prisma.vote.count({
      where: { ideaId, isExcluded: false },
    });
  }

  async countValidVotesByIdeaIds(
    ideaIds: string[],
  ): Promise<Map<string, number>> {
    if (ideaIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.vote.groupBy({
      by: ['ideaId'],
      where: { ideaId: { in: ideaIds }, isExcluded: false },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.ideaId, row._count._all]));
  }

  async hasUserVoted(ideaId: string, userId: string | undefined): Promise<boolean> {
    if (!userId) {
      return false;
    }
    const vote = await this.prisma.vote.findUnique({
      where: { ideaId_userId: { ideaId, userId } },
    });
    return Boolean(vote);
  }

  private async assertVotingEnabled(): Promise<void> {
    const flags = await this.settings.get();
    if (!flags.VOTING) {
      throw new NotFoundException('Voting is not available');
    }
  }

  private requireFraudHashSecret(): string {
    const secret = this.config.get<string>('VOTE_FRAUD_HASH_SECRET')?.trim();
    if (!secret) {
      throw new Error('VOTE_FRAUD_HASH_SECRET is not configured');
    }
    return secret;
  }
}
