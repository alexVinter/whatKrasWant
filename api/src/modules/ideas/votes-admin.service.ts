import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.constants';

export interface IdeaVoteAdminSummary {
  ideaId: string;
  totalVotes: number;
  countedVotes: number;
  excludedVotes: number;
  suspiciousIpGroups: {
    ipHashPrefix: string;
    userCount: number;
    voteCount: number;
    firstVoteAt: string;
    lastVoteAt: string;
  }[];
}

@Injectable()
export class VotesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getIdeaVoteSummary(ideaId: string): Promise<IdeaVoteAdminSummary> {
    const idea = await this.prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) {
      throw new NotFoundException('Initiative not found');
    }

    const votes = await this.prisma.vote.findMany({
      where: { ideaId },
      select: {
        id: true,
        userId: true,
        ipHash: true,
        isExcluded: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalVotes = votes.length;
    const excludedVotes = votes.filter((vote) => vote.isExcluded).length;
    const countedVotes = totalVotes - excludedVotes;

    const byIp = new Map<
      string,
      { users: Set<string>; voteCount: number; first: Date; last: Date }
    >();
    for (const vote of votes) {
      if (!vote.ipHash) {
        continue;
      }
      const bucket = byIp.get(vote.ipHash) ?? {
        users: new Set<string>(),
        voteCount: 0,
        first: vote.createdAt,
        last: vote.createdAt,
      };
      bucket.users.add(vote.userId);
      bucket.voteCount += 1;
      if (vote.createdAt < bucket.first) {
        bucket.first = vote.createdAt;
      }
      if (vote.createdAt > bucket.last) {
        bucket.last = vote.createdAt;
      }
      byIp.set(vote.ipHash, bucket);
    }

    const suspiciousIpGroups = [...byIp.entries()]
      .filter(([, group]) => group.users.size >= 3)
      .map(([ipHash, group]) => ({
        ipHashPrefix: `${ipHash.slice(0, 12)}…`,
        userCount: group.users.size,
        voteCount: group.voteCount,
        firstVoteAt: group.first.toISOString(),
        lastVoteAt: group.last.toISOString(),
      }))
      .sort((a, b) => b.userCount - a.userCount);

    return {
      ideaId,
      totalVotes,
      countedVotes,
      excludedVotes,
      suspiciousIpGroups,
    };
  }

  async excludeVote(voteId: string, adminId: string, reason?: string) {
    const vote = await this.prisma.vote.findUnique({ where: { id: voteId } });
    if (!vote) {
      throw new NotFoundException('Vote not found');
    }

    if (vote.isExcluded) {
      return { success: true, voteId };
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.vote.update({
        where: { id: voteId },
        data: {
          isExcluded: true,
          excludedAt: now,
          exclusionReason: reason?.trim() || null,
        },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.VOTE_EXCLUDED,
          entityType: AUDIT_ENTITIES.VOTE,
          entityId: voteId,
          beforeJson: {
            ideaId: vote.ideaId,
            userId: vote.userId,
            isExcluded: false,
          },
          afterJson: {
            ideaId: vote.ideaId,
            userId: vote.userId,
            isExcluded: true,
            exclusionReason: reason?.trim() || null,
          },
        },
        tx,
      );
    });

    return { success: true, voteId };
  }

  async restoreVote(voteId: string, adminId: string) {
    const vote = await this.prisma.vote.findUnique({ where: { id: voteId } });
    if (!vote) {
      throw new NotFoundException('Vote not found');
    }

    if (!vote.isExcluded) {
      return { success: true, voteId };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vote.update({
        where: { id: voteId },
        data: {
          isExcluded: false,
          excludedAt: null,
          exclusionReason: null,
        },
      });
      await this.audit.write(
        {
          actorId: adminId,
          action: AUDIT_ACTIONS.VOTE_RESTORED,
          entityType: AUDIT_ENTITIES.VOTE,
          entityId: voteId,
          beforeJson: {
            ideaId: vote.ideaId,
            userId: vote.userId,
            isExcluded: true,
            exclusionReason: vote.exclusionReason,
          },
          afterJson: {
            ideaId: vote.ideaId,
            userId: vote.userId,
            isExcluded: false,
          },
        },
        tx,
      );
    });

    return { success: true, voteId };
  }
}
